/**
 * gemini.js — Content script for Gemini (https://gemini.google.com)
 */
(function () {
    'use strict';

    window.createChatWatcher({
        source: 'gemini',
        selectors: {
            user: '.query-text',
            llm: '.model-response-text',
        },
        extractText: (el) => el.innerText.trim(),
    });
})();
