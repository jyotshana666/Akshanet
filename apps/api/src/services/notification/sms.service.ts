import { config } from '../../config.js';

export type SmsTemplate =
  | 'otp'
  | 'apaar-missing'
  | 'verify-reminder'
  | 'consent-request';

const TEMPLATES: Record<SmsTemplate, (data: Record<string, unknown>) => string> = {
  'otp': (data) => `Your Akshanet OTP is ${data.code}. Valid for 5 minutes. Do not share.`,
  'apaar-missing': (data) => `Your APAAR ID could not be found. Please check your records. Ref: ${data.admissionId}`,
  'verify-reminder': (data) => `Please verify your admission record at ${data.institutionName}. Login to Akshanet.`,
  'consent-request': (data) => `${data.employerName} requests access to your records. Review at Akshanet.`,
};

export async function sendSms(
  to: string,
  template: SmsTemplate,
  data: Record<string, unknown>,
): Promise<{ sent: boolean; error?: string }> {
  const templateFn = TEMPLATES[template];
  if (!templateFn) {
    return { sent: false, error: `Unknown template: ${template}` };
  }

  const message = templateFn(data);

  if (config.NODE_ENV === 'test' || !config.TWILIO_SID) {
    return { sent: true };
  }

  try {
    const twilio = await (Function('return import("twilio")')() as Promise<any>);
    const client = twilio.default(config.TWILIO_SID, config.TWILIO_TOKEN);

    await client.messages.create({
      body: message,
      from: config.TWILIO_FROM,
      to,
    });

    return { sent: true };
  } catch {
    return { sent: false, error: 'SMS delivery failed' };
  }
}
