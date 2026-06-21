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
} from './_thinktank-shared.js';

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
        const systemPrompt = [
            'You create a small multi-persona think tank for a user problem.',
            'Return strict JSON only. Do not wrap it in markdown.',
            'The personas must be specific to the problem, not generic archetypes.',
            'Create 3 to 5 personas. Each needs name, role, biography, currentEmotionalState, and relationshipsByName.',
            'Biography must include origin, life path, formative experiences, worldview, values, and speaking style.',
            'relationshipsByName is an object whose keys are other persona names and whose values are short relationship notes when plausible; otherwise use an empty object.',
            'Use the same language as the user problem unless the problem clearly asks for another language.',
            'JSON shape: {"personas":[{"name":"","role":"","biography":"","currentEmotionalState":"","relationshipsByName":{}}]}'
        ].join('\n');

        const userPrompt = [
            'Original problem:',
            originalProblem,
            '',
            pdfContext ? 'Additional PDF context:' : 'Additional PDF context: none',
            pdfContext || ''
        ].join('\n');

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

            return {
                personaId: raw.__personaId,
                name,
                role,
                biography,
                currentEmotionalState,
                relationships: normalizeRelationships(raw.relationshipsByName || raw.relationships, idsByName),
                privateLifeTranscript: [],
                lastSpokenContributions: []
            };
        });

        const sessionId = newId('session').replace(/^session:/, '');
        const session = {
            sessionId,
            createdAt: nowIso(),
            originalProblem,
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
