import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { config } from '../config.js';

export function requireAuth(request, response, next) {
  const [scheme, token] = (request.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    response.status(401).json({ error: 'Kirish talab qilinadi.' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    if (typeof payload.sub !== 'string' || !ObjectId.isValid(payload.sub)) throw new Error('Invalid token subject.');
    request.userId = new ObjectId(payload.sub);
    next();
  } catch {
    response.status(401).json({ error: 'Sessiya yaroqsiz yoki muddati tugagan.' });
  }
}
