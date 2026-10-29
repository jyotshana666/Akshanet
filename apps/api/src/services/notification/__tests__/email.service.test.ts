import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../config.js', () => ({
  config: { NODE_ENV: 'test', SMTP_HOST: 'localhost', SMTP_PORT: 587, SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: 'test@test.com' },
}));

import { sendEmail } from '../email.service.js';

describe('sendEmail', () => {
  it('sends OTP email in test mode', async () => {
    const result = await sendEmail('test@test.com', 'otp', { code: '123456' });
    expect(result.sent).toBe(true);
  });

  it('sends flag-raised email', async () => {
    const result = await sendEmail('admin@inst.edu', 'flag-raised', {
      fieldName: 'name', reason: 'Wrong spelling',
    });
    expect(result.sent).toBe(true);
  });

  it('sends fraud escalation alert', async () => {
    const result = await sendEmail('aicte@gov.in', 'fraud-escalation-alert', {
      admissionId: 'adm-1', riskScore: 0.95,
    });
    expect(result.sent).toBe(true);
  });

  it('returns error for unknown template', async () => {
    const result = await sendEmail('test@test.com', 'nonexistent' as any, {});
    expect(result.sent).toBe(false);
    expect(result.error).toContain('Unknown template');
  });
});
