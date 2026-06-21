/*
 * Server-side Vercel Function. This server layer is the only place that may
 * read process.env.NVIDIA_API_KEY; never expose it to browser code or API
 * responses.
 */
import { logThinktankResultToGoogle } from './_thinktank-google-log.js';
import {
    THINKTANK_MODELS,
    callNvidia,
    getJsonBody,
    jsonError,
    methodNotAllowed,
    nowIso,
    parseModelJson,
    publicPersona,
    readPersonas,
    readSession,
    transcriptToText,
    writePersona,
    writeSession
} from './_thinktank-shared.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res);

    const { sessionId } = getJsonBody(req);
    if (!sessionId) return jsonError(res, 400, 'Missing sessionId');

    try {
        const session = await readSession(sessionId);
        if (!session) return jsonError(res, 404, 'Session not found');

        const personas = await readPersonas(session.personaIds);
        const transcript = session.currentScene?.transcript || [];
        let manifest;

        if (!transcript.length) {
            manifest = {
                sessionNumber: session.sessionNumber,
                consensus: 'No public discussion took place in this session.',
                openQuestions: 'The original problem remains open.',
                fullText: 'No manifest could be formed because the scene ended before any persona spoke.',
                createdAt: nowIso()
            };
        } else {
            const systemPrompt = [
                'You summarize a simulated think tank session into a concise manifest.',
                'Read the complete transcript and extract actual agreement and actual disagreement.',
                'Return strict JSON only. Do not wrap it in markdown.',
                'JSON shape: {"consensus":"","openQuestions":"","fullText":""}.',
                'fullText should be a polished document that can become the starting point for the next session.'
            ].join('\n');

            const userPrompt = [
                `Original problem: ${session.originalProblem}`,
                '',
                'Personas:',
                personas.map((persona) => `- ${persona.name} (${persona.role})`).join('\n'),
                '',
                'Complete public transcript:',
                transcriptToText(transcript)
            ].join('\n');

            // nvidia/nemotron-3-ultra-550b-a55b is used here because manifest creation benefits from long-context synthesis and careful reasoning; only message content is saved.
            const modelText = await callNvidia({
                model: THINKTANK_MODELS.summarizer,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.35,
                maxTokens: 2600,
                responseFormat: { type: 'json_object' },
                extraBody: {
                    chat_template_kwargs: { enable_thinking: true },
                    reasoning_budget: 8192
                }
            });

            const parsed = parseModelJson(modelText);
            manifest = {
                sessionNumber: session.sessionNumber,
                consensus: String(parsed.consensus || '').trim(),
                openQuestions: String(parsed.openQuestions || '').trim(),
                fullText: String(parsed.fullText || parsed.manifest || '').trim(),
                createdAt: nowIso()
            };
        }

        session.manifests = session.manifests || [];
        session.manifests.push(manifest);
        session.status = Number(session.sessionNumber || 1) >= Number(session.maxSessions || 3) ? 'done' : 'scene_ended';
        session.currentScene.paused = false;

        const updatedPersonas = personas.map((persona) => {
            persona.lastSpokenContributions = transcript
                .filter((message) => message.speaker === persona.personaId)
                .map((message) => message.content);
            return persona;
        });

        await Promise.all([
            writeSession(session),
            ...updatedPersonas.map((persona) => writePersona(persona))
        ]);

        const archive = await logThinktankResultToGoogle({
            originalProblem: session.originalProblem,
            pdfContextPresent: Boolean(session.pdfContext),
            manifest,
            personas: updatedPersonas.map(publicPersona),
            sessionNumber: session.sessionNumber
        });

        return res.status(200).json({
            status: session.status,
            manifest,
            archive
        });
    } catch (error) {
        console.error('end-scene failed:', error);
        return jsonError(res, 500, 'Failed to end scene');
    }
}
