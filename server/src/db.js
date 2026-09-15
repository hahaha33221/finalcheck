import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'board.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS assignments (
    seat_key TEXT PRIMARY KEY,
    person_id TEXT NOT NULL UNIQUE,
    assigned_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS departures (
    bus INTEGER PRIMARY KEY,
    departed_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function touchUpdatedAt() {
  const now = Date.now();
  db.prepare('INSERT INTO meta (key, value) VALUES (\'updated_at\', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(String(now));
  return now;
}

export function getState() {
  const assignments = db.prepare('SELECT seat_key, person_id, assigned_at FROM assignments').all();
  const departures = db.prepare('SELECT bus, departed_at FROM departures').all();
  const t = {};
  for (const a of assignments) t[a.seat_key] = { p: a.person_id, at: a.assigned_at };
  const d = {};
  for (const r of departures) d[r.bus] = r.departed_at;
  const row = db.prepare('SELECT value FROM meta WHERE key = \'updated_at\'').get();
  return { t, d, u: row ? Number(row.value) : 0 };
}

export function assignSeat(seatKey, personId) {
  const bus = Number(seatKey.split('-')[0]);
  const departed = db.prepare('SELECT 1 FROM departures WHERE bus = ?').get(bus);
  if (departed) return { error: 'bus_departed' };
  const seatTaken = db.prepare('SELECT person_id FROM assignments WHERE seat_key = ?').get(seatKey);
  if (seatTaken) return { error: 'seat_taken', personId: seatTaken.person_id };
  const already = db.prepare('SELECT seat_key FROM assignments WHERE person_id = ?').get(personId);
  if (already) return { error: 'already_assigned', seatKey: already.seat_key };
  db.prepare('INSERT INTO assignments (seat_key, person_id, assigned_at) VALUES (?, ?, ?)')
    .run(seatKey, personId, Date.now());
  return { ok: true, updatedAt: touchUpdatedAt() };
}

export function cancelSeat(seatKey) {
  const bus = Number(seatKey.split('-')[0]);
  const departed = db.prepare('SELECT 1 FROM departures WHERE bus = ?').get(bus);
  if (departed) return { error: 'bus_departed' };
  const info = db.prepare('DELETE FROM assignments WHERE seat_key = ?').run(seatKey);
  if (info.changes === 0) return { error: 'not_found' };
  return { ok: true, updatedAt: touchUpdatedAt() };
}

export function departBus(bus) {
  const existing = db.prepare('SELECT 1 FROM departures WHERE bus = ?').get(bus);
  if (existing) return { error: 'already_departed' };
  db.prepare('INSERT INTO departures (bus, departed_at) VALUES (?, ?)').run(bus, Date.now());
  return { ok: true, updatedAt: touchUpdatedAt() };
}

export function undepartBus(bus) {
  const info = db.prepare('DELETE FROM departures WHERE bus = ?').run(bus);
  if (info.changes === 0) return { error: 'not_found' };
  return { ok: true, updatedAt: touchUpdatedAt() };
}

export function resetAll() {
  db.prepare('DELETE FROM assignments').run();
  db.prepare('DELETE FROM departures').run();
  return { ok: true, updatedAt: touchUpdatedAt() };
}
