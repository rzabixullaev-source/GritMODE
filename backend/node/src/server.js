import app from './app.js';
import { config } from './config.js';
import { closeDatabase, connectDatabase } from './db.js';
import { startReminderScheduler, stopReminderScheduler } from './services/reminder-scheduler.js';
import { startTelegramIntegration, stopTelegramIntegration } from './services/telegram.js';

let server;

async function start() {
  await connectDatabase();
  server = app.listen(config.PORT, () => console.info(`MARD API listening on port ${config.PORT}`));
  try {
    await startTelegramIntegration();
  } catch (error) {
    console.error('Telegram integration could not start:', error.message);
  }
  startReminderScheduler();
}

async function shutdown(signal) {
  console.info(`${signal} received; stopping MARD API.`);
  stopReminderScheduler();
  stopTelegramIntegration();
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

start().catch((error) => {
  console.error('Could not start MARD API:', error.message);
  process.exit(1);
});
