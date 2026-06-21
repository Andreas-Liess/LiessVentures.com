/*
 * Server-side Vercel Function. This server layer can read persisted simulation
 * state, but it must never expose API keys or server-only credentials.
 */
import {
    getJsonBody,
    jsonError,
    publicPersona,
    readPersonas,
    readSession
} from './_thinktank-shared.js';

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.method === 'GET' ? (req.query || {}) : getJsonBody(req);
    const sessionId = body.sessionId || body.session;
    if (!sessionId) return jsonError(res, 400, 'Missing sessionId');

    try {
        const session = await readSession(sessionId);
        if (!session) return jsonError(res, 404, 'Session not found');

        const personas = await readPersonas(session.personaIds);
        return res.status(200).json({
            session: {
                sessionId: session.sessionId,
                createdAt: session.createdAt,
                originalProblem: session.originalProblem,
                pdfContextPresent: Boolean(session.pdfContext),
                personaIds: session.personaIds,
                sessionNumber: session.sessionNumber,
                maxSessions: session.maxSessions || 3,
                status: session.status,
                currentScene: session.currentScene,
                manifests: session.manifests || []
            },
            personas: personas.map(publicPersona)
        });
    } catch (error) {
        console.error('get-session failed:', error);
        return jsonError(res, 500, 'Failed to load session');
    }
}
