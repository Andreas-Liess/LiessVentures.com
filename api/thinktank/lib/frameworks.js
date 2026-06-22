export const FRAMEWORK_LIBRARY = [
    {
        name: 'Issue Tree / MECE',
        skillText: 'Break the problem into non-overlapping branches until each branch can be tested, assigned, or turned into a concrete workstream.',
        useWhen: 'Broad, messy, multi-causal problems.',
        keywords: ['broad', 'messy', 'multi', 'complex', 'diagnose', 'root', 'cause', 'structure', 'workstream', 'strategy']
    },
    {
        name: 'MECE Principle',
        skillText: 'Check whether categories overlap or miss something important; merge, separate, or add branches as needed.',
        useWhen: 'Structuring categories, branches, option sets, or arguments.',
        keywords: ['category', 'categories', 'options', 'branches', 'structure', 'scope', 'complete', 'overlap']
    },
    {
        name: 'Hypothesis-Driven Problem Solving',
        skillText: 'Start with a tentative answer, then identify what would confirm it, disprove it, and what analysis is needed next.',
        useWhen: 'Strategic diagnosis, business problems, technical/product evaluation.',
        keywords: ['hypothesis', 'evaluate', 'technical', 'product', 'business', 'startup', 'diagnosis', 'test', 'evidence']
    },
    {
        name: 'Evidence-First Countercheck',
        skillText: 'Separate what is known, assumed, and missing before accepting a confident conclusion.',
        useWhen: 'Weak evidence, premature certainty, speculative conclusions.',
        keywords: ['evidence', 'assumption', 'unknown', 'uncertain', 'speculative', 'confidence', 'proof', 'validate']
    },
    {
        name: 'SCQA',
        skillText: 'Structure synthesis as situation, complication, question, and answer.',
        useWhen: 'Final synthesis, executive summary, recommendation memo.',
        keywords: ['summary', 'synthesis', 'memo', 'recommendation', 'question', 'answer', 'client']
    },
    {
        name: 'Pyramid Principle',
        skillText: 'Put the answer first, then support it with grouped reasons.',
        useWhen: 'Clear communication, final recommendation, decision memo.',
        keywords: ['communicate', 'recommendation', 'decision', 'memo', 'clarity', 'executive', 'answer']
    },
    {
        name: 'Jobs to Be Done',
        skillText: 'Identify the functional, emotional, and social job the user is trying to get done.',
        useWhen: 'Product, customer, startup, user behavior, value proposition questions.',
        keywords: ['user', 'customer', 'product', 'startup', 'value', 'market', 'job', 'behavior', 'need']
    },
    {
        name: 'Pre-Mortem',
        skillText: 'Assume the plan failed, list plausible reasons, then convert them into risks and mitigations.',
        useWhen: 'Plans, launches, startups, projects, risky decisions.',
        keywords: ['risk', 'launch', 'plan', 'project', 'failure', 'mitigation', 'startup', 'decision']
    },
    {
        name: 'OODA Loop',
        skillText: 'Observe what changed, orient around the bottleneck, decide what matters next, and act concretely.',
        useWhen: 'Dynamic decisions, turn orchestration, iterative strategy.',
        keywords: ['dynamic', 'iterate', 'next', 'action', 'adapt', 'bottleneck', 'decision', 'strategy']
    },
    {
        name: 'McKinsey 7S',
        skillText: 'Check whether strategy, structure, systems, people, skills, culture, and leadership style fit together.',
        useWhen: 'Organizations, teams, operating models, internal alignment.',
        keywords: ['organization', 'team', 'operating', 'alignment', 'structure', 'systems', 'culture', 'skills']
    },
    {
        name: 'Risk Matrix',
        skillText: 'Estimate likelihood and impact, then prioritize high-likelihood and high-impact risks first.',
        useWhen: 'Risk assessment, uncertainty, project failure modes.',
        keywords: ['risk', 'uncertainty', 'impact', 'likelihood', 'failure', 'mitigation', 'monitor']
    },
    {
        name: 'Decision Matrix',
        skillText: 'Define criteria, weight them, score options, and explain trade-offs.',
        useWhen: 'Comparing options, selecting alternatives, trade-off decisions.',
        keywords: ['choose', 'choice', 'compare', 'options', 'criteria', 'tradeoff', 'decision', 'alternative']
    },
    {
        name: 'Systems Thinking',
        skillText: 'Identify actors, feedback loops, incentives, bottlenecks, and second-order effects.',
        useWhen: 'Complex systems, incentives, feedback loops, second-order effects.',
        keywords: ['system', 'incentive', 'feedback', 'loop', 'second-order', 'complex', 'actors', 'bottleneck']
    },
    {
        name: 'Cost-Benefit Analysis',
        skillText: 'List costs, benefits, uncertainties, and opportunity costs; quantify where possible.',
        useWhen: 'Resource allocation, investment decisions, project evaluation.',
        keywords: ['cost', 'benefit', 'investment', 'resource', 'opportunity', 'budget', 'return', 'allocation']
    },
    {
        name: 'Double Diamond',
        skillText: 'Diverge and converge on the problem, then diverge and converge on the solution.',
        useWhen: 'Design, product discovery, innovation, ambiguous problem solving.',
        keywords: ['design', 'discovery', 'innovation', 'ambiguous', 'problem', 'solution', 'explore', 'define']
    }
];

export function selectOptionalFrameworksForPersona({ persona, goalBrief, originalProblem }) {
    const context = [
        originalProblem,
        goalBrief?.actualQuestion,
        goalBrief?.desiredOutput,
        goalBrief?.decision,
        goalBrief?.constraints,
        goalBrief?.successCriteria,
        goalBrief?.unknowns,
        goalBrief?.problemType,
        persona?.name,
        persona?.role,
        persona?.biography
    ].filter(Boolean).join(' ').toLowerCase();

    const personaSeed = stableHash(`${persona?.name || ''}|${persona?.role || ''}|${originalProblem || ''}`);
    const desiredCount = 1 + (personaSeed % 3);

    return FRAMEWORK_LIBRARY
        .map((framework) => ({
            framework,
            score: frameworkScore(framework, context, personaSeed)
        }))
        .sort((a, b) => b.score - a.score || a.framework.name.localeCompare(b.framework.name))
        .slice(0, desiredCount)
        .map(({ framework }) => ({
            name: framework.name,
            skillText: framework.skillText,
            useWhen: framework.useWhen
        }));
}

function frameworkScore(framework, context, personaSeed) {
    const keywordScore = framework.keywords.reduce((score, keyword) => {
        return context.includes(keyword.toLowerCase()) ? score + 10 : score;
    }, 0);
    const tieBreaker = stableHash(`${personaSeed}|${framework.name}`) % 10;
    return keywordScore + tieBreaker;
}

function stableHash(value) {
    return String(value || '').split('').reduce((hash, char) => {
        return ((hash * 31) + char.charCodeAt(0)) >>> 0;
    }, 2166136261);
}
