/**
 * sessionId.js — Generates and caches a session ID per tab.
 * Uses crypto.randomUUID() and stores in sessionStorage so it
 * persists across SPA navigations but resets on tab close.
 */
(function () {
  'use strict';

  const SESSION_KEY = '__ai_chat_logger_session_id__';

  function generateUUID() {
    // crypto.randomUUID() is available in secure contexts (HTTPS pages)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Store in window so other content scripts can access it
  if (!window[SESSION_KEY]) {
    // Try sessionStorage first (survives SPA navigations)
    let stored = null;
    try {
      stored = sessionStorage.getItem(SESSION_KEY);
    } catch (_) { /* sessionStorage may be blocked */ }

    if (stored) {
      window[SESSION_KEY] = stored;
    } else {
      const id = generateUUID();
      window[SESSION_KEY] = id;
      try {
        sessionStorage.setItem(SESSION_KEY, id);
      } catch (_) { /* ignore */ }
    }
  }

  /**
   * Returns the current session ID for this tab.
   */
  window.getSessionId = function () {
    return window[SESSION_KEY];
  };
})();
