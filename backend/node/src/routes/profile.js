import { Router } from 'express';
import { z } from 'zod';
import { getDatabase } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validTimezone } from '../utils/dates.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (request, response) => {
  const user = await getDatabase().collection('users').findOne(
    { _id: request.userId },
    { projection: { passwordHash: 0 } },
  );
  if (!user) {
    response.status(404).json({ error: 'Profil topilmadi.' });
    return;
  }
  response.json({ ...user, id: user._id.toString(), _id: undefined });
});

router.patch('/', async (request, response) => {
  const parsed = z.object({
    displayName: z.string().trim().min(1).max(60).optional(),
    timezone: z.string().optional(),
  }).safeParse(request.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    response.status(400).json({ error: 'Profil ma’lumotini tekshiring.' });
    return;
  }

  const updates = { updatedAt: new Date() };
  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if (parsed.data.timezone !== undefined) {
    if (!validTimezone(parsed.data.timezone)) {
      response.status(400).json({ error: 'Vaqt mintaqasi noto‘g‘ri.' });
      return;
    }
    updates.timezone = parsed.data.timezone;
  }

  const user = await getDatabase().collection('users').findOneAndUpdate(
    { _id: request.userId }, { $set: updates }, { returnDocument: 'after', projection: { passwordHash: 0 } },
  );
  if (!user) {
    response.status(404).json({ error: 'Profil topilmadi.' });
    return;
  }
  response.json({ ...user, id: user._id.toString(), _id: undefined });
});

export default router;
