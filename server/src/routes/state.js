import { Router } from 'express';
import { requireAdmin } from '../auth.js';
import { getState, assignSeat, cancelSeat, departBus, undepartBus, resetAll } from '../db.js';
import { broadcastState } from '../sse.js';
import { PEOPLE, GROUPS, BUS_COUNT, SEATS } from '../data/roster.js';

export const stateRouter = Router();

// Off by default while the roster is still being set up/edited -- flip
// DEPART_ENABLED=true in server/.env (then restart the service) once the
// team is ready to start locking buses as they leave.
const DEPART_ENABLED = process.env.DEPART_ENABLED === 'true';

const peopleById = new Set(PEOPLE.map((p) => p.i));
const seatKeyRe = /^([1-9]\d*)-([1-9]\d*)$/;

function parseSeatKey(key) {
  const m = typeof key === 'string' && key.match(seatKeyRe);
  if (!m) return null;
  const bus = Number(m[1]);
  const seat = Number(m[2]);
  if (bus < 1 || bus > BUS_COUNT || seat < 1 || seat > SEATS) return null;
  return { bus, seat };
}

function publish() {
  const state = getState();
  broadcastState(state);
  return state;
}

stateRouter.get('/state', (req, res) => {
  res.json(getState());
});

stateRouter.get('/roster', (req, res) => {
  res.json({ groups: GROUPS, people: PEOPLE, busCount: BUS_COUNT, seats: SEATS, departEnabled: DEPART_ENABLED });
});

stateRouter.post('/assign', requireAdmin, (req, res) => {
  const { seatKey, personId } = req.body || {};
  if (!parseSeatKey(seatKey)) return res.status(400).json({ error: 'bad_seat_key' });
  if (!peopleById.has(personId)) return res.status(400).json({ error: 'bad_person_id' });

  const result = assignSeat(seatKey, personId);
  if (result.error) return res.status(409).json(result);
  res.json({ ok: true, state: publish() });
});

stateRouter.post('/cancel', requireAdmin, (req, res) => {
  const { seatKey } = req.body || {};
  if (!parseSeatKey(seatKey)) return res.status(400).json({ error: 'bad_seat_key' });

  const result = cancelSeat(seatKey);
  if (result.error) return res.status(409).json(result);
  res.json({ ok: true, state: publish() });
});

stateRouter.post('/depart', requireAdmin, (req, res) => {
  if (!DEPART_ENABLED) return res.status(403).json({ error: 'depart_disabled' });
  const bus = Number(req.body && req.body.bus);
  if (!Number.isInteger(bus) || bus < 1 || bus > BUS_COUNT) {
    return res.status(400).json({ error: 'bad_bus' });
  }
  const result = departBus(bus);
  if (result.error) return res.status(409).json(result);
  res.json({ ok: true, state: publish() });
});

stateRouter.post('/undepart', requireAdmin, (req, res) => {
  const bus = Number(req.body && req.body.bus);
  if (!Number.isInteger(bus) || bus < 1 || bus > BUS_COUNT) {
    return res.status(400).json({ error: 'bad_bus' });
  }
  const result = undepartBus(bus);
  if (result.error) return res.status(409).json(result);
  res.json({ ok: true, state: publish() });
});

stateRouter.post('/reset', requireAdmin, (req, res) => {
  const result = resetAll();
  res.json({ ok: true, state: publish() });
});
