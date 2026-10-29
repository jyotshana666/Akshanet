import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import { redis } from '../lib/redis.js';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.access_token;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    const revoked = await redis.get(`revoked:session:${payload.sessionId}`);
    if (revoked) {
      res.status(401).json({ error: 'Session revoked' });
      return;
    }

    req.user = {
      sub: payload.sub,
      role: payload.role,
      institutionId: payload.institutionId,
      sessionId: payload.sessionId,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
