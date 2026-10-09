import { getDatabase } from '../db.js';
import { dateKey, previousDateKey } from '../utils/dates.js';

export async function getUserProgress(userId) {
  const database = getDatabase();
  const [user, goal] = await Promise.all([
    database.collection('users').findOne({ _id: userId }, { projection: { timezone: 1 } }),
    database.collection('goals').findOne({ userId, status: 'active' }),
  ]);

  const timezone = user?.timezone || 'Asia/Tashkent';
  const historyStart = new Date(Date.now() - 370 * 24 * 60 * 60 * 1000);
  const since = goal?.startedAt && goal.startedAt > historyStart ? goal.startedAt : historyStart;
  const workouts = await database.collection('workouts').find(
    { userId, completedAt: { $gte: since } },
    { projection: { completedAt: 1 } },
  ).sort({ completedAt: -1 }).limit(5000).toArray();

  const workoutDays = new Set(workouts.map(({ completedAt }) => dateKey(completedAt, timezone)));
  const today = dateKey(new Date(), timezone);
  let cursor = workoutDays.has(today) ? today : previousDateKey(today);
  let currentStreak = 0;
  while (workoutDays.has(cursor)) {
    currentStreak += 1;
    cursor = previousDateKey(cursor);
  }

  return {
    todayCompleted: workoutDays.has(today),
    currentStreak,
    goalTargetDays: goal?.targetDays ?? null,
    goalProgressDays: goal ? Math.min(currentStreak, goal.targetDays) : 0,
    goalCompleted: Boolean(goal && currentStreak >= goal.targetDays),
  };
}
