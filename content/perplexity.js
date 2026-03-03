/**
 * perplexity.js — Content script for Perplexity (https://www.perplexity.ai)
 */
(function () {
    'use strict';

    window.createChatWatcher({
        source: 'perplexity',
        selectors: {
            user: '.whitespace-pre-line',
            llm: '[data-testid="answer"]',
        },
        extractText: (el) => el.innerText.trim(),
    });
})();
