/**
 * EngagementTracker - Tracks scroll depth and paste vs type detection
 */
export class EngagementTracker {
  constructor() {
    this.maxScrollDepth = 0;
    this.typedCharCount = 0;
    this.pastedCharCount = 0;
  }

  init() {
    // Track scroll depth with passive listener
    window.addEventListener('scroll', () => this.updateScrollDepth(), { passive: true });

    // Initial scroll depth (user might already be scrolled)
    this.updateScrollDepth();

    // Track paste events on textarea
    const textarea = document.getElementById('thought');
    if (!textarea) return;

    textarea.addEventListener('paste', (e) => this.handlePaste(e), { passive: true });
    textarea.addEventListener('input', (e) => this.handleInput(e), { passive: true });

    // Store initial value length (in case textarea is pre-filled)
    this.previousLength = textarea.value.length;
  }

  updateScrollDepth() {
    try {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      // Calculate scroll percentage
      const scrollableHeight = documentHeight - windowHeight;
      const scrollPercent = scrollableHeight > 0
        ? Math.round((scrollTop / scrollableHeight) * 100)
        : 0;

      // Update max scroll depth
      this.maxScrollDepth = Math.max(this.maxScrollDepth, scrollPercent);
    } catch (error) {
      console.warn('ScrollDepth tracking failed:', error);
    }
  }

  handlePaste(event) {
    try {
      const pasteData = event.clipboardData?.getData('text') || '';
      this.pastedCharCount += pasteData.length;
    } catch (error) {
      console.warn('Paste tracking failed:', error);
    }
  }

  handleInput(event) {
    try {
      const textarea = event.target;
      const currentLength = textarea.value.length;
      const lengthDiff = currentLength - this.previousLength;

      // If characters were added (not a paste event which is tracked separately)
      if (lengthDiff > 0 && event.inputType !== 'insertFromPaste') {
        this.typedCharCount += lengthDiff;
      }

      this.previousLength = currentLength;
    } catch (error) {
      console.warn('Input tracking failed:', error);
    }
  }

  getInputMethod() {
    const totalChars = this.typedCharCount + this.pastedCharCount;

    if (totalChars === 0) return 'none';

    const pasteRatio = this.pastedCharCount / totalChars;

    if (pasteRatio > 0.8) return 'pasted';
    if (pasteRatio > 0.2) return 'mixed';
    return 'typed';
  }

  getData() {
    try {
      // Final scroll depth update
      this.updateScrollDepth();

      return {
        scrollDepth: this.maxScrollDepth,
        scrollDepthFormatted: `${this.maxScrollDepth}%`,
        inputMethod: this.getInputMethod(),
        typedCharCount: this.typedCharCount,
        pastedCharCount: this.pastedCharCount
      };
    } catch (error) {
      console.warn('EngagementTracker getData failed:', error);
      return {
        scrollDepth: 0,
        scrollDepthFormatted: '0%',
        inputMethod: 'unknown',
        typedCharCount: 0,
        pastedCharCount: 0
      };
    }
  }
}
