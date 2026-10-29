import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../../../lib/redis.js', () => ({ redis: mockRedis }));
vi.mock('../../../lib/audit.js', () => ({ writeAuditEvent: vi.fn() }));
vi.mock('../../../config.js', () => ({
  config: {
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    NODE_ENV: 'test',
  },
}));

import { refreshTokens, logout } from '../session.service.js';
import { signRefreshToken } from '../../../lib/jwt.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('refreshTokens', () => {
  it('returns new tokens for valid refresh token', async () => {
    const sessionId = 'test-session-id';
    const token = signRefreshToken({
      sub: 'user-1',
      role: 'STUDENT',
      sessionId,
    });

    mockRedis.get
      .mockResolvedValueOnce('user-1')
      .mockResolvedValueOnce(null);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');

    const result = await refreshTokens(token);
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  it('returns error for invalid token', async () => {
    const result = await refreshTokens('garbage-token');
    expect(result).toHaveProperty('error');
  });

  it('returns error for revoked session', async () => {
    const token = signRefreshToken({
      sub: 'user-1',
      role: 'STUDENT',
      sessionId: 'revoked-session',
    });

    mockRedis.get
      .mockResolvedValueOnce('user-1')
      .mockResolvedValueOnce('1');
    const result = await refreshTokens(token);
    expect(result).toHaveProperty('error');
  });
});

describe('logout', () => {
  it('revokes session and writes audit event', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);

    await logout('user-1', 'session-1', '127.0.0.1', 'test-agent');

    expect(mockRedis.set).toHaveBeenCalledWith(
      'revoked:session:session-1',
      '1',
      'EX',
      expect.any(Number),
    );
    expect(mockRedis.del).toHaveBeenCalledWith('session:session-1');
  });
});
