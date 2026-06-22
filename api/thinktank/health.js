/*
 * Server-side Vercel Function. This diagnostic endpoint returns only safe
 * configuration status; it never exposes secret values.
 */
import {
    THINKTANK_MODELS,
    callNvidia,
    getKvEnvStatus,
    jsonError,
    testKvConnection
} from './lib/shared.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const deep = req.query?.deep === '1';
    const result = {
        ok: true,
        env: {
            hasNvidiaApiKey: Boolean(process.env.NVIDIA_API_KEY),
            ...getKvEnvStatus()
        },
        kv: {
            checked: false,
            ok: null,
            error: null
        },
        nvidia: {
            checked: false,
            ok: null,
            model: THINKTANK_MODELS.orchestrator,
            error: null
        }
    };

    try {
        result.kv.checked = true;
        result.kv.ok = await testKvConnection();
    } catch (error) {
        result.ok = false;
        result.kv.ok = false;
        result.kv.error = error?.message || 'KV check failed';
    }

    if (deep) {
        try {
            result.nvidia.checked = true;
            const text = await callNvidia({
                model: THINKTANK_MODELS.orchestrator,
                messages: [
                    { role: 'system', content: 'Reply with exactly OK.' },
                    { role: 'user', content: 'Health check' }
                ],
                temperature: 0,
                maxTokens: 16,
                extraBody: { chat_template_kwargs: { thinking: false } }
            });
            result.nvidia.ok = text.trim().toUpperCase().includes('OK');
        } catch (error) {
            result.ok = false;
            result.nvidia.ok = false;
            result.nvidia.error = error?.message || 'NVIDIA check failed';
        }
    }

    if (!result.ok) {
        return jsonError(res, 500, 'Think Tank health check failed', result);
    }

    return res.status(200).json(result);
}
