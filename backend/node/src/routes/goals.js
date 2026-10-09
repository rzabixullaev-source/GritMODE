import { Router } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getUserProgress } from '../services/progress.js';

const router = Router();
router.use(requireAuth);

router.get('/active', async (request, response) => {
  const goal = await getDatabase().collection('goals').findOne({ userId: request.userId, status: 'active' });
  response.json({ goal });
});

router.put('/active', async (request, response) => {
  const parsed = z.object({
    targetDays: z.number().int().min(1).max(365),
    title: z.string().trim().min(1).max(80).default('Mening sport maqsadim'),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Maqsad ma’lumotlarini tekshiring.', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const goals = getDatabase().collection('goals');
  const now = new Date();
  try {
    await goals.updateOne(
      { userId: request.userId, status: 'active' },
      { $set: { status: 'replaced', updatedAt: now } },
    );
    const result = await goals.insertOne({
      userId: request.userId,
      ...parsed.data,
      status: 'active',
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    response.status(201).json({ goal: { _id: result.insertedId, userId: request.userId, ...parsed.data, status: 'active', startedAt: now } });
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'Faol maqsad allaqachon mavjud. Qayta urinib ko‘ring.' });
      return;
    }
    throw error;
  }
});

router.get('/progress', async (request, response) => {
  response.json(await getUserProgress(request.userId));
});

export default router;
