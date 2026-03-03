/**
 * claude.js — Content script for Claude (https://claude.ai)
 */
(function () {
    'use strict';

    window.createChatWatcher({
        source: 'claude',
        selectors: {
            user: '[data-testid="user-message"]',
            llm: '[data-testid="assistant-message"]',
        },
        extractText: (el) => el.innerText.trim(),
    });
})();
