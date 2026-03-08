/**
 * popup.js — Memora Logger popup logic.
 *
 * Handles session selection and syncs the active session
 * to chrome.storage.sync so content scripts can tag captures.
 */
(function () {
  'use strict';

  // ─── Dummy sessions (mirrored from Memora web-client) ───
  const SESSIONS = [
    {
      id: 'research-1',
      title: 'Academic Research',
      tag: 'RESEARCH',
      tagClass: 'tag-research',
      icon: '🔬',
      model: 'Claude',
      date: '2026-03-07',
    },
    {
      id: 'coding-1',
      title: 'Python Project X',
      tag: 'CODING',
      tagClass: 'tag-coding',
      icon: '💻',
      model: 'ChatGPT',
      date: '2026-03-06',
    },
    {
      id: 'writing-1',
      title: 'Thesis Writing',
      tag: 'WRITING',
      tagClass: 'tag-writing',
      icon: '✍️',
      model: 'Claude',
      date: '2026-03-05',
    },
    {
      id: 'general-1',
      title: 'General Exploration',
      tag: 'GENERAL',
      tagClass: 'tag-general',
      icon: '💡',
      model: 'ChatGPT',
      date: '2026-03-04',
    },
  ];

  // ─── DOM refs ───
  const activeSessionArea = document.getElementById('activeSessionArea');
  const sessionsList      = document.getElementById('sessionsList');
  const captureCount      = document.getElementById('captureCount');
  const openWebBtn        = document.getElementById('openWebBtn');

  let selectedSessionId = null;

  // ─── Helpers ───

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ─── Render ───

  function renderActiveSession() {
    const session = SESSIONS.find((s) => s.id === selectedSessionId);

    if (!session) {
      activeSessionArea.innerHTML = `
        <div class="no-session-card">
          <p>No session selected.<br>Choose one below to start logging.</p>
        </div>`;
      return;
    }

    activeSessionArea.innerHTML = `
      <div class="active-session-card">
        <div class="active-session-name">${session.icon} ${session.title}</div>
        <div class="active-session-meta">
          <span class="active-tag">${session.tag}</span>
          <span class="active-model">via ${session.model}</span>
        </div>
      </div>`;
  }

  function renderSessions() {
    sessionsList.innerHTML = '';

    SESSIONS.forEach((session) => {
      const isActive = session.id === selectedSessionId;

      const card = document.createElement('div');
      card.className = `session-card${isActive ? ' active' : ''}`;
      card.innerHTML = `
        <div class="session-icon">${session.icon}</div>
        <div class="session-info">
          <div class="session-title">${session.title}</div>
          <div class="session-meta">
            <span class="tag-sm ${session.tagClass}">${session.tag}</span>
            <span class="session-date">${formatDate(session.date)}</span>
          </div>
        </div>
        <div class="session-check">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>`;

      card.addEventListener('click', () => selectSession(session.id));
      sessionsList.appendChild(card);
    });

    // New session button
    const newBtn = document.createElement('button');
    newBtn.className = 'new-session-btn';
    newBtn.innerHTML = `<span class="new-session-icon">＋</span> New Session`;
    newBtn.addEventListener('click', openMemora);
    sessionsList.appendChild(newBtn);
  }

  // ─── Active platform dots ───

  async function updatePlatformDots() {
    const result = await chrome.storage.local.get('recentCaptures');
    const captures = result.recentCaptures || [];

    const today = new Date().toDateString();
    const todaySources = new Set(
      captures
        .filter((c) => new Date(c.timestamp).toDateString() === today)
        .map((c) => c.source)
    );

    const dotMap = {
      chatgpt:    document.querySelector('.dot-chatgpt'),
      gemini:     document.querySelector('.dot-gemini'),
      perplexity: document.querySelector('.dot-perplexity'),
      claude:     document.querySelector('.dot-claude'),
    };

    Object.entries(dotMap).forEach(([source, el]) => {
      if (el) el.classList.toggle('active', todaySources.has(source));
    });
  }

  // ─── Capture count ───

  async function loadCaptureCount() {
    const result = await chrome.storage.local.get('recentCaptures');
    const captures = result.recentCaptures || [];
    const today = new Date().toDateString();
    const count = captures.filter(
      (c) => new Date(c.timestamp).toDateString() === today
    ).length;
    captureCount.textContent = count;
  }

  // ─── Actions ───

  async function selectSession(id) {
    // Clicking the already-active session deselects it
    selectedSessionId = selectedSessionId === id ? null : id;
    await chrome.storage.sync.set({ selectedSessionId });
    renderActiveSession();
    renderSessions();
  }

  function openMemora() {
    chrome.tabs.create({ url: 'http://localhost:5173' });
  }

  // ─── Init ───

  async function init() {
    const result = await chrome.storage.sync.get('selectedSessionId');
    selectedSessionId = result.selectedSessionId || null;

    renderActiveSession();
    renderSessions();
    loadCaptureCount();
    updatePlatformDots();
  }

  openWebBtn.addEventListener('click', openMemora);

  init();
})();
