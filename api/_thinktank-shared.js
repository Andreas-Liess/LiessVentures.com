/*
 * Server-side Vercel Function helper. This server layer is the only place that
 * may read process.env.NVIDIA_API_KEY; never expose it to browser code or API
 * responses.
 */
import { kv } from '@vercel/kv';
import { randomUUID } from 'node:crypto';

export const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export const THINKTANK_MODELS = {
    personas: 'z-ai/glm-5.1',
    orchestrator: 'deepseek-ai/deepseek-v4-pro',
    speaker: 'moonshotai/kimi-k2.6',
    summarizer: 'nvidia/nemotron-3-ultra-550b-a55b',
    privateScene: 'nvidia/nemotron-3-ultra-550b-a55b'
};

export const MAX_PUBLIC_TURNS_PER_MEETING = 8;
export const DEFAULT_MAX_SESSIONS = 3;
export const MAX_CONFIGURABLE_SESSIONS = 4;

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

export function sessionKey(sessionId) {
    return `session:${normalizeBareSessionId(sessionId)}`;
}

export function normalizeBareSessionId(sessionId) {
    return String(sessionId || '').replace(/^session:/, '').trim();
}

export function personaKey(personaId) {
    const id = String(personaId || '').trim();
    return id.startsWith('persona:') ? id : `persona:${id}`;
}

export async function readJson(key) {
    const value = await kv.get(key);
    if (!value) return null;
    if (typeof value === 'string') return JSON.parse(value);
    return value;
}

export async function writeJson(key, value) {
    await kv.set(key, JSON.stringify(value));
}

export async function readSession(sessionId) {
    const id = normalizeBareSessionId(sessionId);
    if (!id) return null;
    return readJson(sessionKey(id));
}

export async function writeSession(session) {
    await writeJson(sessionKey(session.sessionId), session);
}

export async function readPersona(personaId) {
    if (!personaId) return null;
    return readJson(personaKey(personaId));
}

export async function writePersona(persona) {
    await writeJson(personaKey(persona.personaId), persona);
}

export async function readPersonas(personaIds = []) {
    const personas = await Promise.all(personaIds.map((id) => readPersona(id)));
    return personas.filter(Boolean);
}

export function publicPersona(persona) {
    return {
        personaId: persona.personaId,
        name: persona.name,
        role: persona.role,
        shortBio: truncate(persona.biography || '', 260),
        currentEmotionalState: persona.currentEmotionalState || '',
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

export async function callNvidia({ model, messages, temperature = 0.7, maxTokens = 1600, responseFormat, extraBody }) {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
        throw new Error('Missing NVIDIA_API_KEY environment variable');
    }

    const body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false
    };

    if (responseFormat) body.response_format = responseFormat;
    if (extraBody) body.extra_body = extraBody;

    const response = await fetch(NVIDIA_CHAT_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const responseText = await response.text();
    let payload;
    try {
        payload = responseText ? JSON.parse(responseText) : {};
    } catch {
        payload = { raw: responseText };
    }

    if (!response.ok) {
        const message = payload?.error?.message || payload?.message || JSON.stringify(payload).slice(0, 500);
        throw new Error(`NVIDIA API error ${response.status}: ${message}`);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error('NVIDIA API returned no message content');
    return String(content).trim();
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
