import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { handleTelegramUpdate } from '../services/telegram.js';

const router = Router();

function hasValidWebhookSecret(request) {
  const received = request.get('x-telegram-bot-api-secret-token') || '';
  const expected = config.TELEGRAM_WEBHOOK_SECRET || '';
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

router.post('/webhook', async (request, response) => {
  if (!config.telegramEnabled || config.TELEGRAM_MODE !== 'webhook' || !hasValidWebhookSecret(request)) {
    response.status(401).json({ error: 'Webhook ruxsati yo‘q.' });
    return;
  }

  await handleTelegramUpdate(request.body);
  response.status(200).json({ ok: true });
});

export default router;
