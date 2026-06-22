/*
 * Server-side Vercel Function. This server layer is the only place that may
 * read process.env.NVIDIA_API_KEY; never expose it to browser code or API
 * responses.
 */
import {
    THINKTANK_MODELS,
    callNvidia,
    getJsonBody,
    getLatestManifest,
    jsonError,
    methodNotAllowed,
    nowIso,
    parseModelJson,
    readPersona,
    readPersonas,
    readSession,
    writePersona,
    writeSession
} from './lib/shared.js';
import {
    buildBetweenMeetingsSystemPrompt,
    buildBetweenMeetingsUserPrompt
} from './lib/prompts/between-meetings.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res);

    const body = getJsonBody(req);
    const sessionId = body.sessionId;
    const personaId = body.personaId;
    if (!sessionId || !personaId) return jsonError(res, 400, 'Missing sessionId or personaId');

    try {
        const session = await readSession(sessionId);
        if (!session) return jsonError(res, 404, 'Session not found');

        const persona = await readPersona(personaId);
        if (!persona) return jsonError(res, 404, 'Persona not found');

        const personas = await readPersonas(session.personaIds);
        const latestManifest = getLatestManifest(session);
        const existingCategories = personas
            .filter((item) => item.personaId !== persona.personaId)
            .flatMap((item) => (item.privateLifeTranscript || [])
                .filter((entry) => entry.sessionNumber === session.sessionNumber && entry.categories)
                .map((entry) => ({
                    personaName: item.name,
                    categories: entry.categories
                })));

        const otherPersonas = personas
            .filter((item) => item.personaId !== persona.personaId)
            .map((item) => ({
                name: item.name,
                role: item.role,
                relationship: persona.relationships?.[item.personaId] || ''
            }));

        const systemPrompt = buildBetweenMeetingsSystemPrompt();
        const userPrompt = buildBetweenMeetingsUserPrompt({
            persona,
            sessionNumber: session.sessionNumber,
            latestManifest,
            otherPersonas,
            existingCategories
        });

        // z-ai/glm-5.1 is used here because between-meetings scenes are compact state updates, not deep reasoning artifacts.
        const modelText = await callNvidia({
            model: THINKTANK_MODELS.privateScene,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.62,
            maxTokens: 900,
            responseFormat: { type: 'json_object' }
        });

        const parsed = parseModelJson(modelText);
        const scene = String(parsed.scene || '').trim();
        const currentEmotionalState = String(parsed.currentEmotionalState || persona.currentEmotionalState || '').trim();
        const categories = normalizeCategories(parsed.categories);

        const entry = {
            sessionNumber: session.sessionNumber,
            scene,
            categories,
            timestamp: nowIso()
        };

        persona.privateLifeTranscript = persona.privateLifeTranscript || [];
        persona.privateLifeTranscript.push(entry);
        persona.currentEmotionalState = currentEmotionalState;

        session.status = 'private_scene';

        await Promise.all([
            writePersona(persona),
            writeSession(session)
        ]);

        return res.status(200).json({
            personaId: persona.personaId,
            personaName: persona.name,
            scene,
            currentEmotionalState,
            categories
        });
    } catch (error) {
        console.error('generate-between-meeting-scene failed:', error);
        return jsonError(res, 500, 'Failed to generate between-meetings scene');
    }
}

function normalizeCategories(categories) {
    const value = categories && typeof categories === 'object' ? categories : {};
    return {
        lifeArea: String(value.lifeArea || '').trim(),
        temporalScale: String(value.temporalScale || '').trim(),
        emotionalWeight: String(value.emotionalWeight || '').trim(),
        effectDirection: String(value.effectDirection || '').trim()
    };
}
