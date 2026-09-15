import 'dotenv/config';
import express from 'express';
import cookieSession from 'cookie-session';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { stateRouter } from './routes/state.js';
import { sseHandler } from './sse.js';

const app = express();
const PORT = process.env.PORT || 4000;
const SESSION_SECRET = process.env.SESSION_SECRET;
const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());

if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set. Copy server/.env.example to server/.env and fill it in.');
}

app.set('trust proxy', 1);
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(
  cookieSession({
    name: 'mdboard_session',
    secret: SESSION_SECRET,
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  })
);

app.get('/api/events', sseHandler);
app.use('/api', authRouter);
app.use('/api', stateRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`명동 선착순 승차 확인 API listening on port ${PORT}`);
});
