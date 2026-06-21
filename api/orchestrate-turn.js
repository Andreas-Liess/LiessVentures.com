/*
 * Server-side Vercel Function. This server layer is the only place that may
 * read process.env.NVIDIA_API_KEY; never expose it to browser code or API
 * responses.
 */
import {
    THINKTANK_MODELS,
    MAX_PUBLIC_TURNS_PER_MEETING,
    callNvidia,
    fallbackNextSpeaker,
    getJsonBody,
    jsonError,
    lastTranscriptMessages,
    methodNotAllowed,
    parseModelJson,
    readPersonas,
    readSession,
    transcriptToText,
    truncate
} from './_thinktank-shared.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res);

    const { sessionId } = getJsonBody(req);
    if (!sessionId) return jsonError(res, 400, 'Missing sessionId');

    try {
        const session = await readSession(sessionId);
        if (!session) return jsonError(res, 404, 'Session not found');

        const personas = await readPersonas(session.personaIds);
        if (!personas.length) return jsonError(res, 500, 'No personas found for session');

        const roundNumber = Number(session.currentScene?.roundNumber || 0);
        const maxRounds = Number(session.currentScene?.maxRounds || MAX_PUBLIC_TURNS_PER_MEETING);
        if (roundNumber >= maxRounds) {
            return res.status(200).json({
                endScene: true,
                reason: 'The maximum number of turns has been reached.'
            });
        }

        const nextTurn = roundNumber + 1;
        const isPenultimateTurn = nextTurn === maxRounds - 1;
        const isFinalTurn = nextTurn >= maxRounds;
        const recentMessages = lastTranscriptMessages(session, 15);

        const personaSummary = personas.map((persona) => ({
            personaId: persona.personaId,
            name: persona.name,
            role: persona.role,
            characterization: truncate(`${persona.biography}\nCurrent state: ${persona.currentEmotionalState}`, 520)
        }));

        const systemPrompt = [
            'You are the scene orchestrator for a simulated think tank discussion.',
            'Return strict JSON only. Do not wrap it in markdown.',
            `This is turn ${nextTurn} of ${maxRounds}.`,
            isPenultimateTurn ? 'This is the penultimate turn; steer toward a natural close without forcing agreement.' : '',
            isFinalTurn ? 'This is the final turn of this session. The next speaker must work toward a position they can carry into the manifest and name remaining disagreement.' : '',
            'You may end the scene early if the discussion is exhausted, circular, or has reached a natural closing point.',
            'Do not choose speakers by simple rotation. Justify the next speaker by reference to a concrete previous statement.',
            'If the transcript is empty, choose the persona best suited to open the discussion.',
            'Anonymous Advisor is an in-room participant, not a controller or system voice.',
            'If Anonymous Advisor appears in the transcript, treat that message as a normal discussion contribution from a present but unnamed participant.',
            'JSON shape: {"endScene":false,"reason":"","nextSpeaker":"persona:uuid","respondingTo":"","regieHinweis":""}.',
            'If ending the scene, use {"endScene":true,"reason":"short reason"}.'
        ].filter(Boolean).join('\n');

        const userPrompt = JSON.stringify({
            originalProblem: session.originalProblem,
            roundNumber: nextTurn,
            maxRounds,
            personas: personaSummary,
            recentTranscript: transcriptToText(recentMessages)
        }, null, 2);

        // deepseek-ai/deepseek-v4-pro is used here with thinking disabled because orchestration is frequent and needs fast structured judgement.
        const modelText = await callNvidia({
            model: THINKTANK_MODELS.orchestrator,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.45,
            maxTokens: 1000,
            responseFormat: { type: 'json_object' },
            extraBody: { chat_template_kwargs: { thinking: false } }
        });

        const decision = parseModelJson(modelText);
        if (decision.endScene) {
            return res.status(200).json({
                endScene: true,
                reason: String(decision.reason || 'The orchestrator found a natural stopping point.')
            });
        }

        const validIds = new Set(personas.map((persona) => persona.personaId));
        let nextSpeaker = String(decision.nextSpeaker || '').trim();
        if (!validIds.has(nextSpeaker)) {
            nextSpeaker = fallbackNextSpeaker(session, personas).personaId;
        }

        return res.status(200).json({
            endScene: false,
            reason: String(decision.reason || '').trim(),
            nextSpeaker,
            respondingTo: String(decision.respondingTo || '').trim(),
            regieHinweis: String(decision.regieHinweis || '').trim(),
            isFinalTurn,
            roundNumber: nextTurn,
            maxRounds
        });
    } catch (error) {
        console.error('orchestrate-turn failed:', error);
        return jsonError(res, 500, 'Failed to orchestrate next turn');
    }
}
