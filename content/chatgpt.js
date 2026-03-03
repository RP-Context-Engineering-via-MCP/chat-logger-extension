/**
 * chatgpt.js — Content script for ChatGPT (https://chatgpt.com)
 */
(function () {
    'use strict';

    window.createChatWatcher({
        source: 'chatgpt',
        selectors: {
            user: '[data-message-author-role="user"]',
            llm: '[data-message-author-role="assistant"]',
        },
        extractText: (el) => el.innerText.trim(),
    });
})();
