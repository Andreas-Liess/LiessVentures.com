import { Redis } from '@upstash/redis';
import { randomUUID } from 'node:crypto';

let kvClient;

export function getKvEnvStatus() {
    return {
        hasKvRestUrl: Boolean(process.env.KV_REST_API_URL),
        hasKvRestToken: Boolean(process.env.KV_REST_API_TOKEN),
        hasUpstashRestUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
        hasUpstashRestToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)
    };
}

export function getKvClient() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        throw new Error('Missing Redis environment variables. Set KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.');
    }

    if (!kvClient) {
        kvClient = new Redis({ url, token });
    }

    return kvClient;
}

export async function readJson(key) {
    const value = await getKvClient().get(key);
    if (!value) return null;
    if (typeof value === 'string') return JSON.parse(value);
    return value;
}

export async function writeJson(key, value) {
    await getKvClient().set(key, JSON.stringify(value));
}

export async function testKvConnection() {
    const key = `health:${randomUUID()}`;
    const client = getKvClient();
    await client.set(key, JSON.stringify({ ok: true }), { ex: 60 });
    const value = await client.get(key);
    return Boolean(value);
}
