import { randomBytes, createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { getDatabase } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validTimezone } from '../utils/dates.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (request, response) => {
  const reminder = await getDatabase().collection('reminders').findOne(
    { userId: request.userId },
    { projection: { telegramChatId: 0, telegramUserId: 0 } },
  );
  response.json({ reminder: reminder || { enabled: false, reminderTime: '20:00', timezone: 'Asia/Tashkent' }, telegramConfigured: config.telegramEnabled, telegramLinked: Boolean(reminder?.telegramChatId) });
});

router.put('/', async (request, response) => {
  const parsed = z.object({
    enabled: z.boolean(),
    reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: z.string().max(64),
  }).safeParse(request.body);
  if (!parsed.success || !validTimezone(parsed.data?.timezone)) {
    response.status(400).json({ error: 'Eslatma vaqti yoki vaqt mintaqasi noto‘g‘ri.' });
    return;
  }

  const now = new Date();
  const reminder = await getDatabase().collection('reminders').findOneAndUpdate(
    { userId: request.userId },
    { $set: { ...parsed.data, updatedAt: now }, $setOnInsert: { userId: request.userId, createdAt: now } },
    { upsert: true, returnDocument: 'after', projection: { telegramChatId: 0, telegramUserId: 0 } },
  );
  response.json({ reminder, telegramLinked: Boolean(reminder.telegramChatId) });
});

router.post('/telegram/link-code', async (request, response) => {
  if (!config.telegramEnabled || !config.TELEGRAM_BOT_USERNAME) {
    response.status(503).json({ error: 'Telegram bot hali sozlanmagan.' });
    return;
  }
  const code = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await getDatabase().collection('telegramLinkCodes').insertOne({
    codeHash: createHash('sha256').update(code).digest('hex'),
    userId: request.userId,
    expiresAt,
    createdAt: new Date(),
  });
  response.json({ link: `https://t.me/${config.TELEGRAM_BOT_USERNAME}?start=${code}`, expiresAt });
});

router.delete('/telegram/link', async (request, response) => {
  await getDatabase().collection('reminders').updateOne(
    { userId: request.userId },
    { $unset: { telegramChatId: '', telegramUserId: '', telegramLinkedAt: '' }, $set: { updatedAt: new Date() } },
  );
  response.status(204).end();
});

export default router;
