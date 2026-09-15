const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options
  });
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
  login: (password) => request('/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/logout', { method: 'POST' }),
  assign: (seatKey, personId) =>
    request('/assign', { method: 'POST', body: JSON.stringify({ seatKey, personId }) }),
  cancel: (seatKey) => request('/cancel', { method: 'POST', body: JSON.stringify({ seatKey }) }),
  depart: (bus) => request('/depart', { method: 'POST', body: JSON.stringify({ bus }) }),
  undepart: (bus) => request('/undepart', { method: 'POST', body: JSON.stringify({ bus }) }),
  reset: () => request('/reset', { method: 'POST' })
};

// Live updates: Server-Sent Events with a polling fallback if the stream
// never connects or drops for good (mobile networks, proxies that buffer).
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
    es = new EventSource(BASE + '/events', { withCredentials: true });
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
