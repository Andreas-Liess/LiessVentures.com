/**
 * Analyzer - Derives intent level from behavioral data
 */
export class Analyzer {
  static deriveIntent(data) {
    try {
      const signals = this.calculateSignals(data);
      const intentLevel = this.calculateIntentLevel(signals);
      const reasoning = this.generateReasoning(signals, data);

      return {
        intentLevel,
        reasoning
      };
    } catch (error) {
      console.warn('Intent analysis failed:', error);
      return {
        intentLevel: 'Medium',
        reasoning: 'Analysis unavailable'
      };
    }
  }

  static calculateSignals(data) {
    const signals = {
      timeEngagement: 0,
      typingEffort: 0,
      scrollEngagement: 0,
      contentExploration: 0,
      inputQuality: 0
    };

    // Time engagement score (0-3)
    const timeToSubmitSec = (data.timeToSubmit || 0) / 1000;
    if (timeToSubmitSec > 180) signals.timeEngagement = 3;
    else if (timeToSubmitSec > 90) signals.timeEngagement = 2;
    else if (timeToSubmitSec > 30) signals.timeEngagement = 1;

    // Typing effort score (0-3)
    const typingDurationSec = (data.typingDuration || 0) / 1000;
    if (typingDurationSec > 60) signals.typingEffort = 3;
    else if (typingDurationSec > 45) signals.typingEffort = 2;
    else if (typingDurationSec > 15) signals.typingEffort = 1;

    // Scroll engagement score (0-2)
    const scrollDepth = data.scrollDepth || 0;
    if (scrollDepth > 70) signals.scrollEngagement = 2;
    else if (scrollDepth > 50) signals.scrollEngagement = 1;

    // Content exploration score (0-2)
    const journey = data.journey || [];
    const contentPages = ['vision.html', 'about.html'];
    const visitedContent = journey.some(page => contentPages.includes(page));

    if (journey.length > 2) signals.contentExploration = 2;
    else if (visitedContent || journey.length > 1) signals.contentExploration = 1;

    // Input quality score (0-2)
    const inputMethod = data.inputMethod || 'unknown';
    if (inputMethod === 'typed') signals.inputQuality = 2;
    else if (inputMethod === 'mixed') signals.inputQuality = 1;

    return signals;
  }

  static calculateIntentLevel(signals) {
    // Calculate total score (max 12)
    const totalScore = Object.values(signals).reduce((sum, val) => sum + val, 0);

    // High intent: 8+ points
    if (totalScore >= 8) return 'High';

    // Medium intent: 4-7 points
    if (totalScore >= 4) return 'Medium';

    // Low intent: 0-3 points
    return 'Low';
  }

  static generateReasoning(signals, data) {
    const reasons = [];

    // Time engagement
    if (signals.timeEngagement >= 2) {
      reasons.push('extended engagement');
    } else if (signals.timeEngagement === 0) {
      reasons.push('quick submission');
    }

    // Typing effort
    if (signals.typingEffort >= 2) {
      reasons.push('thoughtful message');
    } else if (signals.typingEffort === 0) {
      reasons.push('brief message');
    }

    // Input method
    if (signals.inputQuality === 2) {
      reasons.push('typed input');
    } else if (signals.inputQuality === 0) {
      reasons.push('pasted content');
    }

    // Content exploration
    if (signals.contentExploration >= 1) {
      reasons.push('explored content');
    }

    // Scroll engagement
    if (signals.scrollEngagement >= 1) {
      reasons.push('read thoroughly');
    }

    // Fallback if no reasons
    if (reasons.length === 0) {
      return 'Standard interaction';
    }

    // Capitalize first letter
    const formatted = reasons.join(', ');
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
}
