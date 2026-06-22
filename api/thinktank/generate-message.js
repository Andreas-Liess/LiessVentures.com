/*
 * Server-side Vercel Function. This server layer is the only place that may
 * read process.env.NVIDIA_API_KEY; never expose it to browser code or API
 * responses.
 */
import {
    THINKTANK_MODELS,
    callNvidia,
    cleanSpeech,
    getJsonBody,
    getLatestManifest,
    jsonError,
    lastTranscriptMessages,
    methodNotAllowed,
    nowIso,
    readPersona,
    readSession,
    transcriptToText,
    writeSession
} from './lib/shared.js';
import {
    buildSpeakerSystemPrompt,
    buildSpeakerUserPrompt
} from './lib/prompts/speaker.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res);

    const body = getJsonBody(req);
    const sessionId = body.sessionId;
    const nextSpeaker = body.nextSpeaker;
    if (!sessionId || !nextSpeaker) return jsonError(res, 400, 'Missing sessionId or nextSpeaker');

    try {
        const session = await readSession(sessionId);
        if (!session) return jsonError(res, 404, 'Session not found');

        const persona = await readPersona(nextSpeaker);
        if (!persona) return jsonError(res, 404, 'Persona not found');

        const recentMessages = lastTranscriptMessages(session, 15);
        const latestManifest = getLatestManifest(session);
        const isFinalTurn = Boolean(body.isFinalTurn);

        const systemPrompt = buildSpeakerSystemPrompt({ isFinalTurn });
        const userPrompt = buildSpeakerUserPrompt({
            persona,
            goalBrief: session.goalBrief || null,
            latestManifest,
            regieHinweis: body.regieHinweis,
            respondingTo: body.respondingTo,
            recentTranscript: transcriptToText(recentMessages)
        });

        // moonshotai/kimi-k2.6 is used here because individual messages benefit from natural voice and nuanced prose.
        const modelText = await callNvidia({
            model: THINKTANK_MODELS.speaker,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.68,
            maxTokens: 1000
        });

        const content = cleanSpeech(modelText);
        const entry = {
            speaker: persona.personaId,
            speakerName: persona.name,
            content,
            timestamp: nowIso()
        };

        session.currentScene.transcript.push(entry);
        session.currentScene.roundNumber = Number(session.currentScene.roundNumber || 0) + 1;
        session.status = 'discussing';
        await writeSession(session);

        return res.status(200).json({
            speaker: persona.personaId,
            speakerName: persona.name,
            content,
            roundNumber: session.currentScene.roundNumber,
            maxRounds: session.currentScene.maxRounds
        });
    } catch (error) {
        console.error('generate-message failed:', error);
        return jsonError(res, 500, 'Failed to generate persona message');
    }
}
