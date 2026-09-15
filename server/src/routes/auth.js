import { Router } from 'express';
import { verifyAdminPassword } from '../auth.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'wrong_password' });
  }
  req.session.isAdmin = true;
  res.json({ ok: true });
});

authRouter.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});
