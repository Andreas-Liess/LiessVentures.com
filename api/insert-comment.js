/*
 * Server-side Vercel Function. This server layer is the only place that may
 * read process.env.NVIDIA_API_KEY; never expose it to browser code or API
 * responses.
 */
import {
    getJsonBody,
    jsonError,
    methodNotAllowed,
    nowIso,
    readSession,
    writeSession
} from './_thinktank-shared.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res);

    const body = getJsonBody(req);
    const sessionId = body.sessionId;
    const comment = String(body.comment || '').trim();

    if (!sessionId || !comment) return jsonError(res, 400, 'Missing sessionId or comment');

    try {
        const session = await readSession(sessionId);
        if (!session) return jsonError(res, 404, 'Session not found');

        const entry = {
            speaker: 'anonymous_advisor',
            speakerName: 'Anonymous Advisor',
            content: comment,
            timestamp: nowIso()
        };

        session.currentScene.transcript.push(entry);
        session.status = 'discussing';
        await writeSession(session);

        return res.status(200).json({ entry });
    } catch (error) {
        console.error('insert-comment failed:', error);
        return jsonError(res, 500, 'Failed to insert comment');
    }
}
