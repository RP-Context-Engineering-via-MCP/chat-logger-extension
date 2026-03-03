/**
 * background.js — Service worker for AI Chat Logger extension.
 *
 * Receives CAPTURE_CHAT messages from content scripts and POSTs
 * them to the chat-logger-backend API. Includes retry logic and
 * stores recent captures in chrome.storage.local for the popup.
 */

const DEFAULT_BACKEND_URL = 'http://localhost:3005';
const MAX_RETRIES = 3;
const MAX_RECENT_CAPTURES = 50;

/**
 * Get the configured backend URL from storage, falling back to default.
 */
async function getBackendUrl() {
    try {
        const result = await chrome.storage.sync.get('backendUrl');
        return result.backendUrl || DEFAULT_BACKEND_URL;
    } catch (_) {
        return DEFAULT_BACKEND_URL;
    }
}

/**
 * POST a chat capture to the backend with retry logic.
 */
async function sendToBackend(payload, attempt = 1) {
    const backendUrl = await getBackendUrl();
    const endpoint = `${backendUrl}/api/chats`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: payload.source,
                session_id: payload.session_id,
                user_prompt: payload.user_prompt,
                llm_response: payload.llm_response,
                metadata: {
                    url: payload.url,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[AI Chat Logger] Saved chat from ${payload.source}`, data);
        return data;
    } catch (error) {
        console.error(
            `[AI Chat Logger] Failed to send (attempt ${attempt}/${MAX_RETRIES}):`,
            error.message
        );

        if (attempt < MAX_RETRIES) {
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt - 1) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
            return sendToBackend(payload, attempt + 1);
        }

        throw error;
    }
}

/**
 * Store a capture in chrome.storage.local for the popup to display.
 */
async function storeRecentCapture(payload) {
    try {
        const result = await chrome.storage.local.get('recentCaptures');
        const captures = result.recentCaptures || [];

        captures.unshift({
            source: payload.source,
            user_prompt: payload.user_prompt.substring(0, 120),
            llm_response: payload.llm_response.substring(0, 120),
            url: payload.url,
            timestamp: new Date().toISOString(),
        });

        // Keep only the most recent N captures
        if (captures.length > MAX_RECENT_CAPTURES) {
            captures.length = MAX_RECENT_CAPTURES;
        }

        await chrome.storage.local.set({ recentCaptures: captures });
    } catch (error) {
        console.error('[AI Chat Logger] Failed to store capture locally:', error);
    }
}

/**
 * Listen for messages from content scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CAPTURE_CHAT') {
        // Handle async — we need to return true and call sendResponse later
        (async () => {
            try {
                await sendToBackend(message);
                await storeRecentCapture(message);
                sendResponse({ success: true });
            } catch (error) {
                await storeRecentCapture({ ...message, error: error.message });
                sendResponse({ success: false, error: error.message });
            }
        })();

        // Return true to indicate we'll call sendResponse asynchronously
        return true;
    }
});
