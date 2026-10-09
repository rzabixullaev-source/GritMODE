import { MongoClient, ServerApiVersion } from 'mongodb';
import { config } from './config.js';

let client;
let database;

export async function connectDatabase() {
  client = new MongoClient(config.MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    appName: 'mard-api',
  });
  await client.connect();
  database = client.db(config.MONGODB_DB);
  await database.command({ ping: 1 });

  await Promise.all([
    database.collection('users').createIndex({ email: 1 }, { unique: true }),
    database.collection('goals').createIndex(
      { userId: 1 },
      { unique: true, partialFilterExpression: { status: 'active' }, name: 'one_active_goal_per_user' },
    ),
    database.collection('workouts').createIndex({ userId: 1, completedAt: -1 }),
    database.collection('reminders').createIndex({ userId: 1 }, { unique: true }),
    database.collection('telegramLinkCodes').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);

  return database;
}

export function getDatabase() {
  if (!database) throw new Error('Database is not connected.');
  return database;
}

export async function closeDatabase() {
  if (client) await client.close();
}
