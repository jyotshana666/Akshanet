import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../config.js', () => ({
  config: { NODE_ENV: 'test', TWILIO_SID: '', TWILIO_TOKEN: '', TWILIO_FROM: '' },
}));

import { sendSms } from '../sms.service.js';

describe('sendSms', () => {
  it('sends OTP SMS in test mode', async () => {
    const result = await sendSms('+919876543210', 'otp', { code: '123456' });
    expect(result.sent).toBe(true);
  });

  it('sends APAAR missing SMS', async () => {
    const result = await sendSms('+919876543210', 'apaar-missing', { admissionId: 'adm-1' });
    expect(result.sent).toBe(true);
  });

  it('sends verify reminder', async () => {
    const result = await sendSms('+919876543210', 'verify-reminder', { institutionName: 'IIT Test' });
    expect(result.sent).toBe(true);
  });

  it('returns error for unknown template', async () => {
    const result = await sendSms('+919876543210', 'nonexistent' as any, {});
    expect(result.sent).toBe(false);
    expect(result.error).toContain('Unknown template');
  });
});
