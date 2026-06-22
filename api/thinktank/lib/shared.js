/*
 * Server-side Vercel Function helper. This server layer is the only place that
 * may read process.env.NVIDIA_API_KEY; never expose it to browser code or API
 * responses.
 */
import { randomUUID } from 'node:crypto';

export {
    NVIDIA_CHAT_URL,
    THINKTANK_MODELS,
    MAX_PUBLIC_TURNS_PER_MEETING,
    DEFAULT_MAX_SESSIONS,
    MAX_CONFIGURABLE_SESSIONS
} from './constants.js';
export {
    getKvEnvStatus,
    getKvClient,
    readJson,
    writeJson,
    testKvConnection
} from './kv.js';
export { callNvidia } from './nvidia.js';
export {
    sessionKey,
    normalizeBareSessionId,
    personaKey,
    readSession,
    writeSession,
    readPersona,
    writePersona,
    readPersonas
} from './session-store.js';

export function newId(prefix) {
    return `${prefix}:${randomUUID()}`;
}

export function nowIso() {
    return new Date().toISOString();
}

export function getJsonBody(req) {
    if (!req.body) return {};
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }
    return req.body;
}

export function methodNotAllowed(res) {
    return res.status(405).json({ error: 'Method not allowed' });
}

export function jsonError(res, status, message, details) {
    const payload = { error: message };
    if (details) payload.details = details;
    return res.status(status).json(payload);
}

export function publicPersona(persona) {
    return {
        personaId: persona.personaId,
        name: persona.name,
        role: persona.role,
        shortBio: truncate(persona.biography || '', 260),
        currentEmotionalState: persona.currentEmotionalState || '',
        optionalFrameworks: persona.optionalFrameworks || [],
        relationships: persona.relationships || {},
        privateLifeTranscript: persona.privateLifeTranscript || []
    };
}

export function lastTranscriptMessages(session, count = 15) {
    const transcript = session?.currentScene?.transcript || [];
    return transcript.slice(Math.max(0, transcript.length - count));
}

export function transcriptToText(transcript = []) {
    if (!transcript.length) return 'No public discussion messages have been produced yet.';
    return transcript
        .map((message, index) => {
            const name = message.speakerName || message.speaker || 'Unknown';
            return `[${index + 1}] ${name}: ${message.content}`;
        })
        .join('\n\n');
}

export function truncate(value, maxLength) {
    const text = String(value || '').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function stripCodeFences(text) {
    return String(text || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

export function parseModelJson(text) {
    const cleaned = stripCodeFences(text);
    try {
        return JSON.parse(cleaned);
    } catch {
        const firstObject = cleaned.indexOf('{');
        const lastObject = cleaned.lastIndexOf('}');
        if (firstObject >= 0 && lastObject > firstObject) {
            return JSON.parse(cleaned.slice(firstObject, lastObject + 1));
        }

        const firstArray = cleaned.indexOf('[');
        const lastArray = cleaned.lastIndexOf(']');
        if (firstArray >= 0 && lastArray > firstArray) {
            return JSON.parse(cleaned.slice(firstArray, lastArray + 1));
        }

        throw new Error('Model did not return parseable JSON');
    }
}

export function cleanSpeech(text) {
    return stripCodeFences(text)
        .replace(/^["']|["']$/g, '')
        .replace(/^\s*[A-Z][^:\n]{1,80}:\s*/, '')
        .trim();
}

export function fallbackNextSpeaker(session, personas) {
    const transcript = session.currentScene?.transcript || [];
    const spokenCounts = new Map(personas.map((persona) => [persona.personaId, 0]));
    transcript.forEach((message) => {
        if (spokenCounts.has(message.speaker)) {
            spokenCounts.set(message.speaker, spokenCounts.get(message.speaker) + 1);
        }
    });

    return personas
        .slice()
        .sort((a, b) => (spokenCounts.get(a.personaId) || 0) - (spokenCounts.get(b.personaId) || 0))[0];
}

export function getLatestManifest(session) {
    const manifests = session.manifests || [];
    return manifests.length ? manifests[manifests.length - 1] : null;
}
