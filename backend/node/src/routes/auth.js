import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { getDatabase } from '../db.js';
import { validTimezone } from '../utils/dates.js';

const router = Router();
const credentials = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(100).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Parol 72 baytdan oshmasligi kerak.'),
});
const registration = credentials.extend({ displayName: z.string().trim().min(1).max(60), timezone: z.string().optional() });

function createToken(userId) {
  return jwt.sign({ sub: userId.toString() }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
}

function userResponse(user, token) {
  return {
    token,
    user: { id: user._id.toString(), email: user.email, displayName: user.displayName, timezone: user.timezone },
  };
}

router.post('/register', async (request, response) => {
  const parsed = registration.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Ma’lumotlarni tekshiring.', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password, displayName } = parsed.data;
  const timezone = validTimezone(parsed.data.timezone) ? parsed.data.timezone : 'Asia/Tashkent';
  const user = {
    email: email.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    displayName,
    timezone,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const result = await getDatabase().collection('users').insertOne(user);
    user._id = result.insertedId;
    response.status(201).json(userResponse(user, createToken(user._id)));
  } catch (error) {
    if (error.code === 11000) {
      response.status(409).json({ error: 'Bu email bilan akkaunt mavjud.' });
      return;
    }
    throw error;
  }
});

router.post('/login', async (request, response) => {
  const parsed = credentials.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Email yoki parol formati noto‘g‘ri.' });
    return;
  }

  const user = await getDatabase().collection('users').findOne({ email: parsed.data.email.toLowerCase() });
  const passwordMatches = user && await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordMatches) {
    response.status(401).json({ error: 'Email yoki parol noto‘g‘ri.' });
    return;
  }
  response.json(userResponse(user, createToken(user._id)));
});

export default router;
