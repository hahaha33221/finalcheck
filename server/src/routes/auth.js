import { Router } from 'express';
import { verifyAdminPassword, isAdminRequest } from '../auth.js';
import { createSession, destroySession } from '../sessions.js';

export const authRouter = Router();

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

authRouter.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'wrong_password' });
  }
  res.json({ ok: true, token: createSession() });
});

authRouter.post('/logout', (req, res) => {
  destroySession(bearerToken(req));
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ isAdmin: isAdminRequest(req) });
});
