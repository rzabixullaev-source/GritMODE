import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import goalsRouter from './routes/goals.js';
import workoutsRouter from './routes/workouts.js';
import remindersRouter from './routes/reminders.js';
import telegramRouter from './routes/telegram.js';
import gymsRouter from './routes/gyms.js';
import { telegramModeStatus } from './services/telegram.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '24kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'gritmode-api', telegram: telegramModeStatus() });
});

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }), authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/workouts', workoutsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/gyms', rateLimit({ windowMs: 5 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }), gymsRouter);

app.use((_request, response) => response.status(404).json({ error: 'Manzil topilmadi.' }));
app.use((error, _request, response, _next) => {
  console.error(error);
  if (response.headersSent) return;
  response.status(500).json({ error: 'Serverda xatolik yuz berdi.' });
});

export default app;
