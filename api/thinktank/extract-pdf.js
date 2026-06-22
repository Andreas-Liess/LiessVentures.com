/*
 * Server-side Vercel Function. Files are processed only on the server; browser
 * code never receives server secrets or direct model credentials.
 */
import pdfParse from 'pdf-parse';
import { getJsonBody, jsonError, methodNotAllowed } from './lib/shared.js';

const MAX_BASE64_LENGTH = 12 * 1024 * 1024;

export default async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res);

    const body = getJsonBody(req);
    const rawBase64 = String(body.fileBase64 || body.pdfBase64 || '').trim();
    if (!rawBase64) return jsonError(res, 400, 'Missing fileBase64');
    if (rawBase64.length > MAX_BASE64_LENGTH) return jsonError(res, 413, 'PDF is too large');

    try {
        const base64 = rawBase64.includes(',') ? rawBase64.split(',').pop() : rawBase64;
        const buffer = Buffer.from(base64, 'base64');
        const data = await pdfParse(buffer);

        return res.status(200).json({
            text: String(data.text || '').trim(),
            pages: data.numpages || null,
            info: data.info || null
        });
    } catch (error) {
        console.error('extract-pdf failed:', error);
        return jsonError(res, 500, 'Failed to extract PDF text');
    }
}
