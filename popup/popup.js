/**
 * popup.js — Memora Logger popup logic.
 *
 * Handles session selection and syncs the active session
 * to chrome.storage.sync so content scripts can tag captures.
 */
(function () {
  'use strict';

  // ─── State ───
  let SESSIONS = [];
  let selectedSessionId = null;
  const API_BASE = 'http://localhost:8080/api';

  const DUMMY_SESSIONS = [
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
  const sessionsList = document.getElementById('sessionsList');
  const captureCount = document.getElementById('captureCount');
  const openWebBtn = document.getElementById('openWebBtn');
  const displayUserId = document.getElementById('displayUserId');


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

  }

  // ─── API Fetching ───

  async function fetchSessionsData(userId) {
    if (!userId) return;

    try {
      // 1. Fetch all sessions
      const sessionsRes = await fetch(`${API_BASE}/users/${userId}/sessions/?skip=0&limit=100`);
      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        // Map backend data to UI format
        const fetchedSessions = (data.sessions || []).map(s => ({
          id: s.session_id,
          title: s.session_name || 'Untitled Session',
          description: s.session_description || '',
          tag: 'MEMORA',
          tagClass: 'tag-general',
          icon: '📝',
          model: 'General',
          date: s.created_at,
        }));

        // If the API call succeeded but returned zero sessions, use dummy data as a fallback
        if (fetchedSessions.length === 0) {
          SESSIONS = DUMMY_SESSIONS;
        } else {
          SESSIONS = fetchedSessions;
        }
      } else {
        throw new Error(`API responded with ${sessionsRes.status}`);
      }

      // 2. Fetch current active session
      const currentRes = await fetch(`${API_BASE}/users/${userId}/current-session`);
      if (currentRes.ok) {
        const currentData = await currentRes.json();
        if (currentData.current_session_id) {
          selectedSessionId = currentData.current_session_id;
          // Cache to sync storage for background.js
          await chrome.storage.sync.set({ selectedSessionId });
        }
      }
    } catch (e) {
      console.error('[AI Chat Logger] Error fetching sessions. Falling back to dummy data:', e);
      SESSIONS = DUMMY_SESSIONS;

      // If no valid selection initially, optionally auto-select the first dummy session
      if (!selectedSessionId || selectedSessionId === 'null' || !SESSIONS.find(s => s.id === selectedSessionId)) {
        selectedSessionId = SESSIONS[0].id;
        await chrome.storage.sync.set({ selectedSessionId });
      }
    }
  }

  async function updateActiveSession(userId, sessionId) {
    if (!userId || !sessionId) return;
    try {
      const response = await fetch(`${API_BASE}/users/${userId}/active-session`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_id: sessionId })
      });
      if (!response.ok) {
        throw new Error(`Failed to update active session: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error('[AI Chat Logger] Error updating active session:', err);
      throw err;
    }
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
      chatgpt: document.querySelector('.dot-chatgpt'),
      gemini: document.querySelector('.dot-gemini'),
      perplexity: document.querySelector('.dot-perplexity'),
      claude: document.querySelector('.dot-claude'),
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

  // ─── User ID ───

  async function loadUserId() {
    const result = await chrome.storage.local.get('userId');
    const userId = result.userId || '5ca4d3ee-a139-44f9-9f9a-84655025a8f2';
    if (displayUserId) {
      displayUserId.textContent = userId;
    }
  }

  // ─── Actions ───

  async function selectSession(id) {
    // Clicking the already-active session deselects it
    selectedSessionId = selectedSessionId === id ? null : id;
    await chrome.storage.sync.set({ selectedSessionId });

    // Sync the selection to the backend via PUT
    if (selectedSessionId) {
      const resultId = await chrome.storage.local.get('userId');
      const userId = resultId.userId || '5ca4d3ee-a139-44f9-9f9a-84655025a8f2';
      try {
        await updateActiveSession(userId, selectedSessionId);
        console.log('[AI Chat Logger] Active session updated on backend:', selectedSessionId);
      } catch (err) {
        console.warn('[AI Chat Logger] Could not update session on backend:', err);
      }
    }

    renderActiveSession();
    renderSessions();
  }

  function openMemora() {
    chrome.tabs.create({ url: 'http://localhost:5173' });
  }

  // ─── Init ───

  async function init() {
    const resultId = await chrome.storage.local.get('userId');
    const userId = resultId.userId || '5ca4d3ee-a139-44f9-9f9a-84655025a8f2';

    // First, restore fallback selected session from sync in case API isn't up
    const syncRes = await chrome.storage.sync.get('selectedSessionId');
    selectedSessionId = syncRes.selectedSessionId || null;

    // Fetch dynamic sessions from backend
    await fetchSessionsData(userId);

    // If fetch failed completely, SESSIONS might be empty. Enforce dummy fallback as last resort.
    if (!SESSIONS || SESSIONS.length === 0) {
      SESSIONS = DUMMY_SESSIONS;
      if (!selectedSessionId || !SESSIONS.find(s => s.id === selectedSessionId)) {
        selectedSessionId = SESSIONS[0].id;
      }
    }

    renderActiveSession();
    renderSessions();
    loadCaptureCount();
    updatePlatformDots();
    loadUserId();
  }

  openWebBtn.addEventListener('click', openMemora);

  init();
})();
