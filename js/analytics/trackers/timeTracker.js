/**
 * TimeTracker - Tracks time-to-submit and typing duration
 */
export class TimeTracker {
  constructor() {
    this.pageLoadTime = Date.now();
    this.typingStartTime = null;
    this.totalTypingDuration = 0;
    this.isTyping = false;
  }

  init() {
    // Listen for input events on the thought textarea
    const textarea = document.getElementById('thought');
    if (!textarea) return;

    textarea.addEventListener('input', () => this.handleInput(), { passive: true });
    textarea.addEventListener('blur', () => this.stopTyping(), { passive: true });
  }

  handleInput() {
    if (!this.isTyping) {
      this.typingStartTime = Date.now();
      this.isTyping = true;
    }
  }

  stopTyping() {
    if (this.isTyping && this.typingStartTime) {
      this.totalTypingDuration += Date.now() - this.typingStartTime;
      this.isTyping = false;
      this.typingStartTime = null;
    }
  }

  getData() {
    try {
      // Stop current typing session if active
      if (this.isTyping) {
        this.stopTyping();
      }

      const timeToSubmit = Date.now() - this.pageLoadTime;
      const typingDuration = this.totalTypingDuration;

      return {
        timeToSubmit,
        timeToSubmitFormatted: this.formatDuration(timeToSubmit),
        typingDuration,
        typingDurationFormatted: this.formatDuration(typingDuration)
      };
    } catch (error) {
      console.warn('TimeTracker failed:', error);
      return {
        timeToSubmit: 0,
        timeToSubmitFormatted: '0s',
        typingDuration: 0,
        typingDurationFormatted: '0s'
      };
    }
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
}
