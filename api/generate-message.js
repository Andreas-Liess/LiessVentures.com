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
} from './_thinktank-shared.js';

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

        const systemPrompt = [
            'You are now the named persona in a simulated think tank.',
            'Write only the spoken contribution in your own voice.',
            'No meta commentary. Do not explain your role. Do not include the speaker name.',
            'Stay faithful to the biography, worldview, emotional state, and speaking style.',
            'Respond to the immediate context and the director note.',
            'Anonymous Advisor is an in-room participant, not a controller or system voice.',
            'If Anonymous Advisor appears in the transcript, treat that message as a normal discussion contribution from a present but unnamed participant.',
            isFinalTurn ? 'This is the final turn of the session. Move toward a position you can carry into the manifest and name where disagreement remains.' : ''
        ].filter(Boolean).join('\n');

        const userPrompt = [
            `Persona name: ${persona.name}`,
            `Role: ${persona.role}`,
            `Biography: ${persona.biography}`,
            `Current emotional state: ${persona.currentEmotionalState}`,
            latestManifest ? `Previous manifest: ${latestManifest.fullText}` : 'Previous manifest: none',
            '',
            `Director note: ${String(body.regieHinweis || '').trim()}`,
            `Responding to: ${String(body.respondingTo || '').trim()}`,
            '',
            'Recent public transcript:',
            transcriptToText(recentMessages)
        ].join('\n');

        // moonshotai/kimi-k2.6 is used here because individual messages benefit from natural voice and nuanced prose.
        const modelText = await callNvidia({
            model: THINKTANK_MODELS.speaker,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.78,
            maxTokens: 1400
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
