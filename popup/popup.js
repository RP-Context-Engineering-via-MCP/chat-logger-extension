/**
 * popup.js — Logic for the AI Chat Logger popup.
 *
 * Loads recent captures from chrome.storage.local, checks backend
 * health, and provides settings UI for configuring the backend URL.
 */
(function () {
    'use strict';

    const DEFAULT_BACKEND_URL = 'http://localhost:3005';

    // ─── DOM refs ───
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const totalCount = document.getElementById('totalCount');
    const todayCount = document.getElementById('todayCount');
    const sourcesCount = document.getElementById('sourcesCount');
    const capturesList = document.getElementById('capturesList');
    const emptyState = document.getElementById('emptyState');
    const backendUrlInput = document.getElementById('backendUrl');
    const saveBtn = document.getElementById('saveBtn');
    const saveFeedback = document.getElementById('saveFeedback');

    /**
     * Format a relative timestamp (e.g. "2m ago", "1h ago").
     */
    function relativeTime(isoString) {
        const diff = Date.now() - new Date(isoString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    /**
     * Check if the backend is reachable.
     */
    async function checkBackendHealth() {
        const result = await chrome.storage.sync.get('backendUrl');
        const url = result.backendUrl || DEFAULT_BACKEND_URL;

        try {
            const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3000) });
            if (response.ok) {
                statusDot.classList.add('connected');
                statusText.textContent = 'Connected';
            } else {
                throw new Error('Not OK');
            }
        } catch (_) {
            statusDot.classList.remove('connected');
            statusText.textContent = 'Offline';
        }
    }

    /**
     * Load and render recent captures.
     */
    async function loadCaptures() {
        const result = await chrome.storage.local.get('recentCaptures');
        const captures = result.recentCaptures || [];

        // Stats
        totalCount.textContent = captures.length;

        const today = new Date().toDateString();
        const todayCaptures = captures.filter(
            (c) => new Date(c.timestamp).toDateString() === today
        );
        todayCount.textContent = todayCaptures.length;

        const uniqueSources = new Set(captures.map((c) => c.source));
        sourcesCount.textContent = uniqueSources.size;

        // Render list
        if (captures.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        capturesList.innerHTML = '';

        captures.forEach((capture) => {
            const card = document.createElement('div');
            card.className = 'capture-card';

            const sourceClass = (capture.source || 'unknown').toLowerCase();

            card.innerHTML = `
        <div class="capture-header">
          <span class="source-badge ${sourceClass}">${capture.source || 'Unknown'}</span>
          <span class="capture-time">${relativeTime(capture.timestamp)}</span>
        </div>
        <div class="capture-prompt">${escapeHtml(capture.user_prompt || '')}</div>
      `;

            capturesList.appendChild(card);
        });
    }

    /**
     * Escape HTML to prevent XSS from captured content.
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Load saved backend URL into the input field.
     */
    async function loadSettings() {
        const result = await chrome.storage.sync.get('backendUrl');
        backendUrlInput.value = result.backendUrl || DEFAULT_BACKEND_URL;
    }

    /**
     * Save backend URL to chrome.storage.sync.
     */
    saveBtn.addEventListener('click', async () => {
        const url = backendUrlInput.value.trim();
        if (!url) return;

        await chrome.storage.sync.set({ backendUrl: url });

        saveFeedback.classList.add('visible');
        setTimeout(() => saveFeedback.classList.remove('visible'), 2000);

        // Re-check health with updated URL
        checkBackendHealth();
    });

    // ─── Init ───
    loadSettings();
    loadCaptures();
    checkBackendHealth();
})();
