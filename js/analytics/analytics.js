/**
 * Analytics Orchestrator - Main entry point for analytics system
 */
import { TimeTracker } from './trackers/timeTracker.js';
import { NavigationTracker } from './trackers/navigationTracker.js';
import { EngagementTracker } from './trackers/engagementTracker.js';
import { ContextTracker } from './trackers/contextTracker.js';
import { Analyzer } from './analyzer.js';

class AnalyticsOrchestrator {
  constructor() {
    this.trackers = {
      time: new TimeTracker(),
      nav: new NavigationTracker(),
      engagement: new EngagementTracker(),
      context: new ContextTracker()
    };

    this.initialized = false;
  }

  init() {
    try {
      // Initialize all trackers
      Object.values(this.trackers).forEach(tracker => {
        try {
          tracker.init();
        } catch (error) {
          console.warn('Tracker initialization failed:', error);
        }
      });

      // Attach form interceptor
      this.attachFormInterceptor();

      this.initialized = true;
      console.log('✅ Analytics system initialized');
    } catch (error) {
      console.error('Analytics initialization failed:', error);
    }
  }

  attachFormInterceptor() {
    const form = document.getElementById('firepitForm');
    if (!form) {
      console.warn('Form not found - analytics disabled');
      return;
    }

    // Intercept form submission at capture phase (runs before existing handlers)
    form.addEventListener('submit', (e) => {
      // Don't prevent default - let existing handler do that
      // Just append our metadata before submission
      this.handleSubmit();
    }, { capture: true, once: false });
  }

  handleSubmit() {
    try {
      // Collect all data
      const data = this.collectData();

      // Derive intent
      const intent = Analyzer.deriveIntent(data);

      // Store structured JSON data globally for form submission
      window.lvAnalyticsData = this.getStructuredData(data, intent);

      console.log('✅ Analytics data processed');
    } catch (error) {
      console.error('Analytics submission handling failed:', error);
      // Don't block form submission on error
    }
  }

  getStructuredData(data, intent) {
    try {
      return {
        intentLevel: intent.intentLevel,
        intentReasoning: intent.reasoning,
        timeToSubmitMs: data.timeToSubmit,
        timeToSubmit: data.timeToSubmitFormatted,
        typingDurationMs: data.typingDuration,
        typingDuration: data.typingDurationFormatted,
        inputMethod: data.inputMethod,
        scrollDepth: data.scrollDepth,
        journey: data.journey,
        journeyFormatted: data.journeyFormatted,
        entryPage: data.entryPage,
        referrer: data.referrer,
        device: data.device,
        resolution: data.resolution,
        language: data.language,
        timezone: data.timezone,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.warn('Failed to create structured data:', error);
      return {};
    }
  }

  collectData() {
    const data = {};

    // Collect from each tracker
    try {
      Object.assign(data, this.trackers.time.getData());
    } catch (error) {
      console.warn('Time tracker data collection failed:', error);
    }

    try {
      Object.assign(data, this.trackers.nav.getData());
    } catch (error) {
      console.warn('Navigation tracker data collection failed:', error);
    }

    try {
      Object.assign(data, this.trackers.engagement.getData());
    } catch (error) {
      console.warn('Engagement tracker data collection failed:', error);
    }

    try {
      Object.assign(data, this.trackers.context.getData());
    } catch (error) {
      console.warn('Context tracker data collection failed:', error);
    }

    return data;
  }
}

// Auto-initialize when DOM is ready
function initializeAnalytics() {
  try {
    const orchestrator = new AnalyticsOrchestrator();
    orchestrator.init();

    // Expose globally for verification
    window.lvAnalyticsReady = true;
  } catch (error) {
    console.error('❌ Analytics initialization failed:', error);
    window.lvAnalyticsReady = false;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAnalytics);
} else {
  // DOM already loaded
  initializeAnalytics();
}

// Debug export
console.log('📦 Analytics module loaded');
