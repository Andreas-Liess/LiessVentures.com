/**
 * Formatter - Formats analytics data into human-readable meta block
 */
export class Formatter {
  static format(data, intent) {
    try {
      const timestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const lines = [
        '',
        '────────────────────────────────',
        '📊 INTERACTION METADATA',
        '────────────────────────────────',
        `Intent Level: ${intent.intentLevel}`,
        `Signal: ${intent.reasoning}`,
        '',
        `Time to Submit: ${data.timeToSubmitFormatted || '0s'}`,
        `Typing Duration: ${data.typingDurationFormatted || '0s'}`,
        `Input Method: ${this.capitalizeFirst(data.inputMethod || 'unknown')}`,
        `Scroll Depth: ${data.scrollDepthFormatted || '0%'}`,
        '',
        `Journey: ${data.journeyFormatted || 'Direct'}`,
        `Entry Page: ${this.formatPageName(data.entryPage)}`,
        `Referrer: ${data.referrer || 'Direct'}`,
        '',
        `Device: ${data.device || 'Unknown'}`,
        `Resolution: ${data.resolution || 'Unknown'}`,
        `Language: ${data.language || 'Unknown'}`,
        `Timezone: ${data.timezone || 'Unknown'}`,
        `Submitted: ${timestamp}`,
        '────────────────────────────────'
      ];

      return lines.join('\n');
    } catch (error) {
      console.warn('Formatting failed:', error);
      return '\n\n[Analytics data unavailable]';
    }
  }

  static capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  static formatPageName(page) {
    const pageNames = {
      'index.html': 'Home',
      'vision.html': 'Vision',
      'connect.html': 'Connect',
      'about.html': 'About'
    };

    return pageNames[page] || page || 'Unknown';
  }
}
