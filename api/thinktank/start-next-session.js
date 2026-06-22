/*
 * Server-side Vercel Function. This server layer can update persisted session
 * state, but it must never expose API keys or server-only credentials.
 */
import {
    MAX_PUBLIC_TURNS_PER_MEETING,
    getJsonBody,
    jsonError,
    methodNotAllowed,
    readSession,
    writeSession
} from './lib/shared.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res);

    const body = getJsonBody(req);
    const sessionId = body.sessionId;
    if (!sessionId) return jsonError(res, 400, 'Missing sessionId');

    try {
        const session = await readSession(sessionId);
        if (!session) return jsonError(res, 404, 'Session not found');

        const maxSessions = Math.max(1, Math.min(4, Math.round(Number(session.maxSessions || 3))));
        if (Number(session.sessionNumber || 1) >= maxSessions) {
            session.status = 'done';
            await writeSession(session);
            return jsonError(res, 409, 'Maximum number of meetings reached');
        }

        session.sessionNumber = Number(session.sessionNumber || 1) + 1;
        session.status = 'discussing';
        session.currentScene = {
            roundNumber: 0,
            maxRounds: MAX_PUBLIC_TURNS_PER_MEETING,
            transcript: [],
            paused: false
        };

        await writeSession(session);
        return res.status(200).json({
            sessionId: session.sessionId,
            sessionNumber: session.sessionNumber,
            maxSessions: session.maxSessions || 3,
            status: session.status,
            currentScene: session.currentScene,
            manifests: session.manifests || []
        });
    } catch (error) {
        console.error('start-next-session failed:', error);
        return jsonError(res, 500, 'Failed to start next session');
    }
}
