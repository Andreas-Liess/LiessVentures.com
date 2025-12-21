/**
 * ContextTracker - Captures language, timezone, device type, and screen resolution
 */
export class ContextTracker {
  constructor() {
    // Data is static, capture immediately
    this.data = this.captureContext();
  }

  init() {
    // No initialization needed - context is static
  }

  captureContext() {
    return {
      language: this.getLanguage(),
      timezone: this.getTimezone(),
      device: this.getDeviceType(),
      resolution: this.getResolution()
    };
  }

  getLanguage() {
    try {
      return navigator.language || navigator.userLanguage || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  getTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  getDeviceType() {
    try {
      const ua = navigator.userAgent.toLowerCase();
      const width = window.innerWidth;

      // Check for mobile/tablet based on user agent and screen width
      if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'Tablet';
      }

      if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
        return 'Mobile';
      }

      // Also check screen width as fallback
      if (width <= 768) {
        return 'Mobile';
      } else if (width <= 1024) {
        return 'Tablet';
      }

      return 'Desktop';
    } catch {
      return 'Unknown';
    }
  }

  getResolution() {
    try {
      const width = window.screen.width || window.innerWidth;
      const height = window.screen.height || window.innerHeight;
      return `${width}x${height}`;
    } catch {
      return 'Unknown';
    }
  }

  getData() {
    try {
      return this.data;
    } catch (error) {
      console.warn('ContextTracker getData failed:', error);
      return {
        language: 'Unknown',
        timezone: 'Unknown',
        device: 'Unknown',
        resolution: 'Unknown'
      };
    }
  }
}
