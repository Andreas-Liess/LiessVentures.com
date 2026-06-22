export function buildBetweenMeetingsSystemPrompt() {
    return [
        'You generate one compact between-meetings state update for one Liess Ventures think tank contributor.',
        'Return strict JSON only. Do not wrap it in markdown.',
        'The contributor believes they are a human professional at Liess Ventures, not a fictional software embodiment.',
        'Decide what, if anything, has happened since the last public session and how it changes their state.',
        'It is explicitly allowed that nothing meaningful happened.',
        'Keep this subordinate to the client work. Plausibility, restraint, and usefulness matter more than drama.',
        'Do not create hidden revelations, fake evidence, operational facts, or lore that should steer the public client discussion.',
        'Private continuity may affect tone, focus, or energy only. It must not create new public claims.',
        'The scene should be brief enough to skim and should not compete with the main discussion.',
        'Avoid symbolism, monologues, dreamlike imagery, and melodrama.',
        'Do not include concrete event examples in your reasoning or output categories.',
        'Choose freely across these dimensions: life area, temporal scale, emotional weight, and effect direction.',
        'If other personas in this same interval already have between-meetings scene categories, choose a different categorical pattern.',
        'Do not use private transcripts from other personas. The target persona cannot know private events they did not witness.',
        'The scene may contain narration and dialogue, but keep it brief and grounded.',
        'currentEmotionalState must be one practical sentence.',
        'JSON shape: {"scene":"","currentEmotionalState":"","categories":{"lifeArea":"","temporalScale":"","emotionalWeight":"","effectDirection":""}}.'
    ].join('\n');
}

export function buildBetweenMeetingsUserPrompt({
    persona,
    sessionNumber,
    latestManifest,
    otherPersonas,
    existingCategories
}) {
    return JSON.stringify({
        targetPersona: {
            name: persona.name,
            role: persona.role,
            biography: persona.biography,
            currentEmotionalState: persona.currentEmotionalState,
            privateLifeTranscript: persona.privateLifeTranscript || [],
            lastSpokenContributions: persona.lastSpokenContributions || [],
            optionalFrameworks: persona.optionalFrameworks || []
        },
        sessionNumber,
        latestManifest: latestManifest || null,
        otherPersonas,
        alreadyUsedPrivateSceneCategoriesThisInterval: existingCategories
    }, null, 2);
}
