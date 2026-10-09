import { Router } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (request, response) => {
  const limit = Math.min(Math.max(Number.parseInt(request.query.limit, 10) || 30, 1), 100);
  const workouts = await getDatabase().collection('workouts')
    .find({ userId: request.userId })
    .sort({ completedAt: -1 })
    .limit(limit)
    .toArray();
  response.json({ workouts });
});

router.post('/', async (request, response) => {
  const parsed = z.object({
    exerciseKey: z.literal('squat').default('squat'),
    reps: z.number().int().min(1).max(1000),
    durationSeconds: z.number().int().min(0).max(86400).default(0),
    source: z.enum(['camera', 'manual']).default('camera'),
    completedAt: z.coerce.date().optional(),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Mashq ma’lumotlarini tekshiring.', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const workout = {
    userId: request.userId,
    ...parsed.data,
    completedAt: parsed.data.completedAt || new Date(),
    createdAt: new Date(),
  };
  const result = await getDatabase().collection('workouts').insertOne(workout);
  response.status(201).json({ workout: { _id: result.insertedId, ...workout } });
});

export default router;
