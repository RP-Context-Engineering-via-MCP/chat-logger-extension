/**
 * domWatcher.js — Shared MutationObserver logic for detecting
 * user + AI message pairs across different chat platforms.
 *
 * Each site-specific content script calls `createChatWatcher(config)`.
 */
(function () {
    'use strict';

    /**
     * Creates a MutationObserver that watches for new chat messages.
     *
     * @param {Object} config
     * @param {string}   config.source       — e.g. "chatgpt", "gemini", "perplexity", "claude"
     * @param {Object}   config.selectors
     * @param {string}   config.selectors.user  — CSS selector for user message containers
     * @param {string}   config.selectors.llm   — CSS selector for assistant message containers
     * @param {Function} [config.extractText]   — optional fn(element) → string; defaults to innerText
     * @param {string}   [config.observeTarget] — CSS selector for the container to observe; defaults to document.body
     */
    window.createChatWatcher = function (config) {
        const {
            source,
            selectors,
            extractText = (el) => el.innerText.trim(),
            observeTarget,
        } = config;

        // Track messages we've already captured to avoid duplicates
        const capturedSet = new Set();

        function hashContent(text) {
            // Simple hash for deduplication
            let hash = 0;
            for (let i = 0; i < text.length; i++) {
                const chr = text.charCodeAt(i);
                hash = ((hash << 5) - hash) + chr;
                hash |= 0;
            }
            return hash.toString();
        }

        /**
         * Scans the page for all user/assistant pairs and sends any new ones.
         */
        function scanForNewPairs() {
            const userEls = document.querySelectorAll(selectors.user);
            const llmEls = document.querySelectorAll(selectors.llm);

            // We pair messages by index: user[0] ↔ llm[0], user[1] ↔ llm[1], etc.
            const pairCount = Math.min(userEls.length, llmEls.length);

            for (let i = 0; i < pairCount; i++) {
                const userText = extractText(userEls[i]);
                const llmText = extractText(llmEls[i]);

                // Skip empty messages
                if (!userText || !llmText) continue;

                // Skip very short LLM responses (likely still streaming)
                if (llmText.length < 10) continue;

                const pairKey = hashContent(userText + '|||' + llmText);

                if (capturedSet.has(pairKey)) continue;
                capturedSet.add(pairKey);

                // Send to background service worker
                chrome.runtime.sendMessage({
                    type: 'CAPTURE_CHAT',
                    source: source,
                    session_id: window.getSessionId ? window.getSessionId() : 'unknown',
                    user_prompt: userText,
                    llm_response: llmText,
                    url: window.location.href,
                });

                console.log(`[AI Chat Logger] Captured ${source} pair #${i + 1}`);
            }
        }

        /**
         * Start observing the DOM.
         */
        function startObserver() {
            const target = observeTarget
                ? document.querySelector(observeTarget)
                : document.body;

            if (!target) {
                // Target not found yet, retry after a short delay
                console.log(`[AI Chat Logger] Waiting for observe target on ${source}...`);
                setTimeout(startObserver, 2000);
                return;
            }

            const observer = new MutationObserver((mutations) => {
                // Debounce: only scan once mutations settle
                clearTimeout(window.__chatLoggerDebounce);
                window.__chatLoggerDebounce = setTimeout(scanForNewPairs, 1500);
            });

            observer.observe(target, {
                childList: true,
                subtree: true,
            });

            // Initial scan in case messages are already on the page
            setTimeout(scanForNewPairs, 3000);

            console.log(`[AI Chat Logger] Watching ${source} for chat messages.`);
        }

        // Wait for the page to be fully loaded before starting
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            startObserver();
        } else {
            window.addEventListener('DOMContentLoaded', startObserver);
        }
    };
})();
