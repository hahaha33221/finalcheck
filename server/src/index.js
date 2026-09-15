import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { stateRouter } from './routes/state.js';
import { sseHandler } from './sse.js';

const app = express();
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());

app.set('trust proxy', 1);
app.use(cors({ origin: CORS_ORIGIN, allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

app.get('/api/events', sseHandler);
app.use('/api', authRouter);
app.use('/api', stateRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`명동 선착순 승차 확인 API listening on port ${PORT}`);
});
