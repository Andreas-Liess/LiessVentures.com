import { NVIDIA_CHAT_URL } from './constants.js';

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
