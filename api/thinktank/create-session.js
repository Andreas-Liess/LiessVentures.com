/*
 * Server-side Vercel Function. This server layer is the only place that may
 * read process.env.NVIDIA_API_KEY; never expose it to browser code or API
 * responses.
 */
import {
    THINKTANK_MODELS,
    DEFAULT_MAX_SESSIONS,
    MAX_CONFIGURABLE_SESSIONS,
    MAX_PUBLIC_TURNS_PER_MEETING,
    callNvidia,
    getJsonBody,
    jsonError,
    methodNotAllowed,
    newId,
    nowIso,
    parseModelJson,
    publicPersona,
    writeJson,
    writeSession
} from './lib/shared.js';
import {
    buildCreatePersonasSystemPrompt,
    buildCreatePersonasUserPrompt
} from './lib/prompts/create-personas.js';
import { selectOptionalFrameworksForPersona } from './lib/frameworks.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res);

    let stage = 'input';
    const body = getJsonBody(req);
    const originalProblem = String(body.problem || body.originalProblem || '').trim();
    const pdfContext = body.pdfContext ? String(body.pdfContext).trim() : null;
    const requestedMaxSessions = Number(body.maxSessions || DEFAULT_MAX_SESSIONS);
    const maxSessions = Math.max(
        1,
        Math.min(
            MAX_CONFIGURABLE_SESSIONS,
            Number.isFinite(requestedMaxSessions) ? Math.round(requestedMaxSessions) : DEFAULT_MAX_SESSIONS
        )
    );

    if (!originalProblem) {
        return jsonError(res, 400, 'Missing problem');
    }

    try {
        const systemPrompt = buildCreatePersonasSystemPrompt();
        const userPrompt = buildCreatePersonasUserPrompt({ originalProblem, pdfContext });

        stage = 'nvidia_persona_generation';
        // z-ai/glm-5.1 is used here because persona creation needs broad judgement and structured writing, but not the longest context model.
        const modelText = await callNvidia({
            model: THINKTANK_MODELS.personas,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.72,
            maxTokens: 2800,
            responseFormat: { type: 'json_object' }
        });

        stage = 'parse_personas';
        const parsed = parseModelJson(modelText);
        const goalBrief = normalizeGoalBrief(parsed.goalBrief, originalProblem);
        const rawPersonas = Array.isArray(parsed.personas) ? parsed.personas.slice(0, 5) : [];
        if (rawPersonas.length < 3) {
            throw new Error('Model returned fewer than 3 personas');
        }

        const idsByName = new Map();
        rawPersonas.forEach((persona) => {
            const id = newId('persona');
            idsByName.set(String(persona.name || '').trim().toLowerCase(), id);
            persona.__personaId = id;
        });

        const personas = rawPersonas.map((raw, index) => {
            const name = String(raw.name || `Persona ${index + 1}`).trim();
            const role = String(raw.role || 'Think tank participant').trim();
            const biography = String(raw.biography || '').trim();
            const currentEmotionalState = String(raw.currentEmotionalState || 'Attentive, composed, and ready to engage.').trim();

            const persona = {
                personaId: raw.__personaId,
                name,
                role,
                biography,
                currentEmotionalState,
                relationships: normalizeRelationships(raw.relationshipsByName || raw.relationships, idsByName),
                privateLifeTranscript: [],
                lastSpokenContributions: []
            };

            persona.optionalFrameworks = selectOptionalFrameworksForPersona({
                persona,
                goalBrief,
                originalProblem
            });

            return persona;
        });

        const sessionId = newId('session').replace(/^session:/, '');
        const session = {
            sessionId,
            createdAt: nowIso(),
            originalProblem,
            goalBrief,
            pdfContext,
            personaIds: personas.map((persona) => persona.personaId),
            sessionNumber: 1,
            maxSessions,
            status: 'discussing',
            currentScene: {
                roundNumber: 0,
                maxRounds: MAX_PUBLIC_TURNS_PER_MEETING,
                transcript: [],
                paused: false
            },
            manifests: []
        };

        stage = 'kv_write';
        await Promise.all([
            ...personas.map((persona) => writeJson(persona.personaId, persona)),
            writeSession(session)
        ]);

        return res.status(200).json({
            sessionId,
            status: session.status,
            maxSessions: session.maxSessions,
            goalBrief: session.goalBrief,
            personas: personas.map(publicPersona),
            currentScene: session.currentScene
        });
    } catch (error) {
        console.error('create-session failed:', error);
        return jsonError(res, 500, 'Failed to create Think Tank session', {
            stage,
            reason: error?.message || 'Unknown error'
        });
    }
}

function normalizeGoalBrief(input, originalProblem) {
    const value = input && typeof input === 'object' ? input : {};
    return {
        actualQuestion: String(value.actualQuestion || originalProblem || '').trim(),
        desiredOutput: String(value.desiredOutput || '').trim(),
        decision: String(value.decision || '').trim(),
        constraints: String(value.constraints || '').trim(),
        successCriteria: String(value.successCriteria || '').trim(),
        unknowns: String(value.unknowns || '').trim(),
        problemType: String(value.problemType || '').trim()
    };
}

function normalizeRelationships(input, idsByName) {
    const output = {};

    if (Array.isArray(input)) {
        input.forEach((item) => {
            const rawName = String(item.name || item.persona || item.target || '').trim().toLowerCase();
            const targetId = idsByName.get(rawName);
            if (targetId) output[targetId] = String(item.description || item.relationship || item.note || '').trim();
        });
        return output;
    }

    if (input && typeof input === 'object') {
        Object.entries(input).forEach(([name, note]) => {
            const targetId = idsByName.get(String(name).trim().toLowerCase());
            if (targetId && String(note || '').trim()) output[targetId] = String(note).trim();
        });
    }

    return output;
}
