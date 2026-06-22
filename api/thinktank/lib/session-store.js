import { readJson, writeJson } from './kv.js';

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
