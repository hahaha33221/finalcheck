// When the frontend and API are served from the same origin (the VPS/nginx
// setup), leave VITE_API_BASE unset and relative '/api' just works. When the
// frontend is hosted separately (e.g. on Vercel) point VITE_API_BASE at the
// API's own origin, e.g. https://api.example.com/api.
const BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

const TOKEN_KEY = 'mdboard.token';

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode / storage disabled: session just won't persist */
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const res = await fetch(BASE + path, { ...options, headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error((body && body.error) || `http_${res.status}`);
    err.status = res.status;
    err.code = body && body.error;
    err.body = body;
    throw err;
  }
  return body;
}

export const api = {
  getRoster: () => request('/roster'),
  getState: () => request('/state'),
  me: () => request('/me'),
  login: async (password) => {
    const res = await request('/login', { method: 'POST', body: JSON.stringify({ password }) });
    setToken(res.token);
    return res;
  },
  logout: async () => {
    try {
      await request('/logout', { method: 'POST' });
    } finally {
      setToken(null);
    }
  },
  clearSession: () => setToken(null),
  assign: (seatKey, personId) =>
    request('/assign', { method: 'POST', body: JSON.stringify({ seatKey, personId }) }),
  cancel: (seatKey) => request('/cancel', { method: 'POST', body: JSON.stringify({ seatKey }) }),
  depart: (bus) => request('/depart', { method: 'POST', body: JSON.stringify({ bus }) }),
  undepart: (bus) => request('/undepart', { method: 'POST', body: JSON.stringify({ bus }) }),
  reset: () => request('/reset', { method: 'POST' })
};

// Live updates: Server-Sent Events with a polling fallback if the stream
// never connects or drops for good (mobile networks, proxies that buffer).
// /api/events is public (no admin check), so no auth token is needed here.
export function subscribeState(onState, onStatus) {
  let closed = false;
  let pollTimer = null;
  let es = null;

  function startPolling() {
    if (pollTimer) return;
    onStatus && onStatus('polling');
    const tick = async () => {
      if (closed) return;
      try {
        onState(await api.getState());
        onStatus && onStatus('polling');
      } catch {
        onStatus && onStatus('offline');
      }
      if (!closed) pollTimer = setTimeout(tick, 8000);
    };
    tick();
  }

  function stopPolling() {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  try {
    es = new EventSource(BASE + '/events');
    es.addEventListener('state', (e) => {
      try {
        onState(JSON.parse(e.data));
        onStatus && onStatus('live');
        stopPolling();
      } catch {
        /* ignore malformed frame */
      }
    });
    es.onerror = () => {
      // EventSource retries on its own; fall back to polling in the meantime
      // so the board still updates if the stream stays down.
      startPolling();
    };
  } catch {
    startPolling();
  }

  return () => {
    closed = true;
    stopPolling();
    es && es.close();
  };
}
