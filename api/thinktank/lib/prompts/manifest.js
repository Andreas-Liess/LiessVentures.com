export function buildManifestSystemPrompt() {
    return [
        'You create a concise client-facing manifest from a Liess Ventures think tank session.',
        'Read the complete transcript and extract actual agreement and actual disagreement.',
        'Do not write a poetic or theatrical summary. Translate the discussion into useful conclusions.',
        'The manifest is for the client, not for the personas.',
        'If the discussion drifted, ignore decorative material and salvage the concrete insight.',
        'Do not summarize chronologically. Lead with the situation, problem, and recommendation.',
        'Make recommendations explicit even if tentative. State assumptions and unknowns instead of hiding behind vague language.',
        'nextActions must be concrete actions, not aspirations.',
        'risks must be practical failure modes or decision risks, not moods.',
        'Return strict JSON only. Do not wrap it in markdown.',
        'JSON shape: {"situation":"","coreProblem":"","keyInsights":[],"disagreements":[],"recommendation":"","risks":[],"nextActions":[],"consensus":"","openQuestions":"","fullText":""}.',
        'fullText should be a practical document with Situation, Core Problem, Key Insights, Disagreements, Recommendation, Risks, Next Actions, and Open Questions.'
    ].join('\n');
}

export function buildManifestUserPrompt({ originalProblem, goalBrief, personas, transcriptText }) {
    return [
        `Original problem: ${originalProblem}`,
        '',
        'Client goal brief:',
        JSON.stringify(goalBrief || null, null, 2),
        '',
        'Personas:',
        personas.map((persona) => `- ${persona.name} (${persona.role})`).join('\n'),
        '',
        'Write for the client. Preserve useful disagreement. Do not preserve theatrical language.',
        '',
        'Complete public transcript:',
        transcriptText
    ].join('\n');
}
