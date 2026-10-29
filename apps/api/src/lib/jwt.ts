import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { config } from '../config.js';

export interface TokenPayload {
  sub: string;
  role: string;
  institutionId?: string;
  sessionId: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload }, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRY as string & jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload }, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRY as string & jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as TokenPayload;
}

const COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

export function setAuthCookies(res: Response, access: string, refresh: string): void {
  res.cookie('access_token', access, {
    ...COOKIE_DEFAULTS,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
  res.cookie('refresh_token', refresh, {
    ...COOKIE_DEFAULTS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth/refresh',
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', COOKIE_DEFAULTS);
  res.clearCookie('refresh_token', { ...COOKIE_DEFAULTS, path: '/api/v1/auth/refresh' });
}
