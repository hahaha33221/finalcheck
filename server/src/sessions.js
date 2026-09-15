import crypto from 'node:crypto';
import { db } from './db.js';

const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Persisted to SQLite (not just in-memory) so an admin login survives the
// API process restarting -- which happens routinely during deploys/updates.
export function createSession() {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, expires_at) VALUES (?, ?)').run(token, Date.now() + TTL_MS);
  return token;
}

export function verifySession(token) {
  if (!token) return false;
  const row = db.prepare('SELECT expires_at FROM sessions WHERE token = ?').get(token);
  if (!row) return false;
  if (Date.now() > row.expires_at) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return false;
  }
  return true;
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// Periodic sweep so the table doesn't grow unbounded across many logins.
setInterval(() => {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}, 60 * 60 * 1000).unref();
