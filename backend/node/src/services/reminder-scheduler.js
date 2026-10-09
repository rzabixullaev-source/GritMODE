import { config } from '../config.js';
import { getDatabase } from '../db.js';
import { dateKey, localTimeKey } from '../utils/dates.js';
import { sendTelegramMessage } from './telegram.js';

let timer;
let running = false;

async function deliverDueReminders() {
  if (running || !config.telegramEnabled) return;
  running = true;
  try {
    const now = new Date();
    const reminders = await getDatabase().collection('reminders')
      .find({ enabled: true, telegramChatId: { $exists: true } })
      .toArray();

    for (const reminder of reminders) {
      const today = dateKey(now, reminder.timezone || 'Asia/Tashkent');
      if (localTimeKey(now, reminder.timezone || 'Asia/Tashkent') !== reminder.reminderTime || reminder.lastSentDate === today) continue;

      const claim = await getDatabase().collection('reminders').updateOne(
        { _id: reminder._id, lastSentDate: { $ne: today } },
        { $set: { lastSentDate: today, updatedAt: now } },
      );
      if (claim.modifiedCount !== 1) continue;

      try {
        const user = await getDatabase().collection('users').findOne({ _id: reminder.userId }, { projection: { timezone: 1, displayName: 1 } });
        const timezone = reminder.timezone || user?.timezone || 'Asia/Tashkent';
        const start = new Date(now.getTime() - 36 * 60 * 60 * 1000);
        const workouts = await getDatabase().collection('workouts').find(
          { userId: reminder.userId, completedAt: { $gte: start } },
          { projection: { completedAt: 1 } },
        ).toArray();
        const completedToday = workouts.some((workout) => dateKey(workout.completedAt, timezone) === today);
        if (!completedToday) {
          await sendTelegramMessage(reminder.telegramChatId, `Salom${user?.displayName ? `, ${user.displayName}` : ''}! Bugungi mashqingiz hali qayd etilmadi. Maqsadingizni saqlab qolish uchun kun tugashidan oldin shug‘ullaning 💪`);
        }
      } catch (error) {
        await getDatabase().collection('reminders').updateOne(
          { _id: reminder._id, lastSentDate: today },
          { $unset: { lastSentDate: '' } },
        );
        console.error('Reminder delivery failed:', error.message);
      }
    }
  } catch (error) {
    console.error('Reminder scheduler failed:', error.message);
  } finally {
    running = false;
  }
}

export function startReminderScheduler() {
  if (!config.telegramEnabled || timer) return;
  timer = setInterval(() => void deliverDueReminders(), config.REMINDER_CHECK_INTERVAL_MS);
  timer.unref?.();
  void deliverDueReminders();
}

export function stopReminderScheduler() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
