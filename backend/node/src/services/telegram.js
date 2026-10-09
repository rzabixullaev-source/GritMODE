import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { getDatabase } from '../db.js';

const apiBase = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;
let polling = false;
let pollController;
let nextUpdateId = 0;
let integrationStatus = 'not-configured';

async function callTelegram(method, payload = {}, signal) {
  const response = await fetch(`${apiBase}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: signal || AbortSignal.timeout(35_000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram ${method} failed (${response.status}).`);
  }
  return result.result;
}

export async function sendTelegramMessage(chatId, text) {
  return callTelegram('sendMessage', { chat_id: chatId, text });
}

export async function handleTelegramUpdate(update) {
  const message = update?.message;
  const chatId = message?.chat?.id;
  const telegramUserId = message?.from?.id;
  if (!chatId || !telegramUserId || message.chat.type !== 'private' || typeof message.text !== 'string') return;

  const text = message.text.trim();
  const startMatch = text.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+([A-Za-z0-9_-]{20,80}))?\s*$/i);
  if (startMatch) {
    if (!startMatch[1]) {
      await sendTelegramMessage(chatId, 'GritMODE botiga xush kelibsiz! Hisobingizni ulash uchun ilovadagi “Telegram botni ulash” tugmasini bosing, so‘ng bu yerda Start’ni bosing.');
      return;
    }

    const codeHash = createHash('sha256').update(startMatch[1]).digest('hex');
    const codes = getDatabase().collection('telegramLinkCodes');
    const linkCode = await codes.findOne({ codeHash, expiresAt: { $gt: new Date() } });
    if (!linkCode) {
      await sendTelegramMessage(chatId, 'Ulash havolasi eskirgan yoki ishlatilgan. GritMODE ilovasidan yangi havola oling.');
      return;
    }

    await getDatabase().collection('reminders').updateOne(
      { userId: linkCode.userId },
      {
        $set: { telegramChatId: chatId, telegramUserId, telegramLinkedAt: new Date(), updatedAt: new Date() },
        $setOnInsert: { enabled: false, reminderTime: '20:00', timezone: 'Asia/Tashkent', createdAt: new Date() },
      },
      { upsert: true },
    );
    await codes.deleteOne({ _id: linkCode._id });
    await sendTelegramMessage(chatId, 'GritMODE hisobingiz ulandi! Eslatmalarni ilovada yoqing — mashg‘ulotni unutib qo‘ysangiz, xabar beramiz.');
    return;
  }

  if (/^\/(help|start)(?:@[A-Za-z0-9_]+)?\s*$/i.test(text)) {
    await sendTelegramMessage(chatId, 'Hisobni ulash uchun GritMODE ilovasidagi Telegram tugmasidan foydalaning. Eslatmalarni esa ilovada boshqarasiz.');
  }
}

async function pollUpdates() {
  while (polling) {
    try {
      const updates = await callTelegram('getUpdates', {
        offset: nextUpdateId,
        timeout: 25,
        allowed_updates: ['message'],
      }, pollController.signal);
      for (const update of updates) {
        nextUpdateId = update.update_id + 1;
        try {
          await handleTelegramUpdate(update);
        } catch (error) {
          console.error('Telegram update failed:', error.message);
        }
      }
    } catch (error) {
      if (!polling) break;
      console.error('Telegram polling error:', error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

export async function startTelegramIntegration() {
  if (!config.telegramEnabled) return;
  integrationStatus = 'connecting';
  try {
    const bot = await callTelegram('getMe');
    if (bot.username?.toLowerCase() !== config.TELEGRAM_BOT_USERNAME.toLowerCase()) {
      throw new Error(`TELEGRAM_BOT_USERNAME does not match token bot @${bot.username}.`);
    }

    if (config.TELEGRAM_MODE === 'webhook') {
      await callTelegram('setWebhook', {
        url: config.TELEGRAM_WEBHOOK_URL,
        secret_token: config.TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ['message'],
      });
      integrationStatus = 'webhook';
      console.info(`Telegram webhook enabled for @${bot.username}.`);
      return;
    }

    await callTelegram('deleteWebhook', { drop_pending_updates: false });
    polling = true;
    pollController = new AbortController();
    integrationStatus = 'polling';
    console.info(`Telegram polling enabled for @${bot.username}.`);
    void pollUpdates();
  } catch (error) {
    integrationStatus = 'error';
    throw error;
  }
}

export function stopTelegramIntegration() {
  polling = false;
  pollController?.abort();
  pollController = undefined;
}

export function telegramModeStatus() {
  return integrationStatus;
}
