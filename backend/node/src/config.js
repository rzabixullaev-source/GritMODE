import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required.'),
  MONGODB_DB: z.string().min(1).default('mard'),
  JWT_SECRET: z.string().min(32).refine((value) => !/replace|example|change-me/i.test(value), 'Set a private JWT_SECRET.'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:5500,http://127.0.0.1:5500'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_MODE: z.enum(['polling', 'webhook']).default('polling'),
  TELEGRAM_WEBHOOK_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  REMINDER_CHECK_INTERVAL_MS: z.coerce.number().int().min(15000).default(60000),
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map(({ path, message }) => `${path.join('.')}: ${message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const config = Object.freeze({
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  TELEGRAM_BOT_USERNAME: parsed.data.TELEGRAM_BOT_USERNAME?.replace(/^@/, ''),
  telegramEnabled: Boolean(parsed.data.TELEGRAM_BOT_TOKEN && parsed.data.TELEGRAM_BOT_USERNAME),
});

if (parsed.data.TELEGRAM_MODE === 'webhook' && parsed.data.TELEGRAM_BOT_TOKEN) {
  if (!parsed.data.TELEGRAM_WEBHOOK_SECRET || parsed.data.TELEGRAM_WEBHOOK_SECRET.length < 16) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET must contain at least 16 characters in webhook mode.');
  }
  if (!parsed.data.TELEGRAM_WEBHOOK_URL?.startsWith('https://')) {
    throw new Error('TELEGRAM_WEBHOOK_URL must be a public HTTPS URL in webhook mode.');
  }
}
