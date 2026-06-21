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
} from './_thinktank-shared.js';

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

        const systemPrompt = [
            'You generate one between-meetings internal scene for one fictional think tank persona.',
            'Return strict JSON only. Do not wrap it in markdown.',
            'Decide what, if anything, has happened in this persona life since the last public session and how it changes their state.',
            'It is explicitly allowed that nothing meaningful happened.',
            'Do not rely on the most dramatic possibility by reflex. Plausibility and character fidelity matter more than drama.',
            'Do not include concrete event examples in your reasoning or output categories.',
            'Choose freely across these dimensions: life area, temporal scale, emotional weight, and effect direction.',
            'If other personas in this same interval already have between-meetings scene categories, choose a different categorical pattern.',
            'Do not use private transcripts from other personas. The target persona cannot know private events they did not witness.',
            'The scene may contain narration and dialogue, but it must stay fully in-world.',
            'JSON shape: {"scene":"","currentEmotionalState":"","categories":{"lifeArea":"","temporalScale":"","emotionalWeight":"","effectDirection":""}}.'
        ].join('\n');

        const userPrompt = JSON.stringify({
            targetPersona: {
                name: persona.name,
                role: persona.role,
                biography: persona.biography,
                currentEmotionalState: persona.currentEmotionalState,
                privateLifeTranscript: persona.privateLifeTranscript || [],
                lastSpokenContributions: persona.lastSpokenContributions || []
            },
            sessionNumber: session.sessionNumber,
            latestManifest: latestManifest || null,
            otherPersonas,
            alreadyUsedPrivateSceneCategoriesThisInterval: existingCategories
        }, null, 2);

        // nvidia/nemotron-3-ultra-550b-a55b is used here because between-meetings scenes need character-depth reasoning and creative continuity; only final content is saved.
        const modelText = await callNvidia({
            model: THINKTANK_MODELS.privateScene,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.86,
            maxTokens: 3600,
            responseFormat: { type: 'json_object' },
            extraBody: {
                chat_template_kwargs: { enable_thinking: true },
                reasoning_budget: 8192
            }
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
        console.error('generate-private-scene failed:', error);
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
