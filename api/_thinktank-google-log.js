/*
 * Server-side Vercel Function helper. Secrets and archive endpoints belong only
 * on the server; never expose logging targets or API keys to browser code.
 */
import { randomUUID } from 'node:crypto';

const EXISTING_FIREPIT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdgKXT6HC4BFfc2NFUb_2uoD9ttko4eoAoOG3O8d9Vh2yDoyw/formResponse';

const EXISTING_FIREPIT_ENTRIES = {
    thought: 'entry.1495536293',
    name: 'entry.192007185',
    email: 'entry.1316279483',
    analytics: 'entry.1664885520'
};

export async function logThinktankResultToGoogle({ originalProblem, manifest, personas, sessionNumber, pdfContextPresent }) {
    if (process.env.THINKTANK_GOOGLE_LOG_DISABLED === 'true') {
        return { attempted: false, ok: false, disabled: true };
    }

    const logId = randomUUID();
    const capturedAt = new Date().toISOString();
    const metadata = {
        type: 'thinktank_result',
        logId,
        capturedAt,
        sessionNumber,
        pdfContextPresent: Boolean(pdfContextPresent),
        personas: (personas || []).map((persona) => ({
            name: persona.name,
            role: persona.role
        }))
    };

    const customFormUrl = process.env.THINKTANK_LOG_GOOGLE_FORM_URL;
    const targetUrl = customFormUrl || EXISTING_FIREPIT_FORM_URL;
    const body = customFormUrl
        ? buildCustomLogBody({ originalProblem, manifest, metadata })
        : buildExistingFirepitBody({ originalProblem, manifest, metadata });

    if (!body) {
        return {
            attempted: false,
            ok: false,
            logId,
            error: 'No Google Form fields configured'
        };
    }

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        });

        return {
            attempted: true,
            ok: response.ok || response.status === 0,
            status: response.status,
            logId,
            target: customFormUrl ? 'custom-thinktank-form' : 'existing-firepit-form'
        };
    } catch (error) {
        console.error('Think Tank Google logging failed:', error);
        return {
            attempted: true,
            ok: false,
            logId,
            error: 'Google logging request failed'
        };
    }
}

function buildExistingFirepitBody({ originalProblem, manifest, metadata }) {
    const archiveText = [
        'THINK TANK RESULT ARCHIVE',
        '',
        'Original problem:',
        originalProblem || '',
        '',
        'Consensus:',
        manifest?.consensus || '',
        '',
        'Open questions:',
        manifest?.openQuestions || '',
        '',
        'Manifest:',
        manifest?.fullText || ''
    ].join('\n');

    return new URLSearchParams({
        [EXISTING_FIREPIT_ENTRIES.thought]: archiveText,
        [EXISTING_FIREPIT_ENTRIES.name]: 'Think Tank Archive',
        [EXISTING_FIREPIT_ENTRIES.email]: 'anonymous-thinktank@liessventures.local',
        [EXISTING_FIREPIT_ENTRIES.analytics]: JSON.stringify(metadata, null, 2)
    });
}

function buildCustomLogBody({ originalProblem, manifest, metadata }) {
    const fields = {
        problem: process.env.THINKTANK_LOG_ENTRY_PROBLEM,
        consensus: process.env.THINKTANK_LOG_ENTRY_CONSENSUS,
        openQuestions: process.env.THINKTANK_LOG_ENTRY_OPEN_QUESTIONS,
        manifest: process.env.THINKTANK_LOG_ENTRY_MANIFEST,
        metadata: process.env.THINKTANK_LOG_ENTRY_METADATA,
        logId: process.env.THINKTANK_LOG_ENTRY_LOG_ID,
        sessionNumber: process.env.THINKTANK_LOG_ENTRY_SESSION_NUMBER
    };

    const params = new URLSearchParams();
    if (fields.problem) params.set(fields.problem, originalProblem || '');
    if (fields.consensus) params.set(fields.consensus, manifest?.consensus || '');
    if (fields.openQuestions) params.set(fields.openQuestions, manifest?.openQuestions || '');
    if (fields.manifest) params.set(fields.manifest, manifest?.fullText || '');
    if (fields.metadata) params.set(fields.metadata, JSON.stringify(metadata, null, 2));
    if (fields.logId) params.set(fields.logId, metadata.logId);
    if (fields.sessionNumber) params.set(fields.sessionNumber, String(metadata.sessionNumber || ''));

    return Array.from(params.keys()).length ? params : null;
}
