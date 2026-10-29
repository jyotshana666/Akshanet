import { config } from '../../config.js';

export type EmailTemplate =
  | 'otp'
  | 'student-verify-reminder'
  | 'flag-raised'
  | 'flag-resolved'
  | 'institution-approved'
  | 'institution-rejected'
  | 'employer-consent-request'
  | 'employer-access-revoked'
  | 'fraud-escalation-alert';

const TEMPLATES: Record<EmailTemplate, (data: Record<string, unknown>) => { subject: string; html: string }> = {
  'otp': (data) => ({
    subject: 'Your Akshanet OTP',
    html: `<p>Your verification code is: <strong>${data.code}</strong></p><p>This code expires in 5 minutes.</p>`,
  }),
  'student-verify-reminder': (data) => ({
    subject: 'Action Required: Verify Your Admission Record',
    html: `<p>Dear Student,</p><p>Your admission record at ${data.institutionName} needs your verification. Please log in to verify your details.</p>`,
  }),
  'flag-raised': (data) => ({
    subject: `Data Issue Flagged: ${data.fieldName}`,
    html: `<p>A student has flagged an issue with the field <strong>${data.fieldName}</strong>.</p><p>Reason: ${data.reason}</p>`,
  }),
  'flag-resolved': (data) => ({
    subject: 'Your Data Issue Has Been Resolved',
    html: `<p>The issue you flagged for <strong>${data.fieldName}</strong> has been resolved.</p>`,
  }),
  'institution-approved': (data) => ({
    subject: 'Institution Approved',
    html: `<p>Your institution ${data.institutionName} has been approved on Akshanet.</p>`,
  }),
  'institution-rejected': (data) => ({
    subject: 'Institution Application Update',
    html: `<p>Your institution application has been reviewed. Reason: ${data.reason}</p>`,
  }),
  'employer-consent-request': (data) => ({
    subject: 'Employer Requests Access to Your Records',
    html: `<p>${data.employerName} has requested access to your academic records. Please review this request in your portal.</p>`,
  }),
  'employer-access-revoked': (data) => ({
    subject: 'Student Access Revoked',
    html: `<p>A student has revoked your access to their records. Consent ID: ${data.consentId}</p>`,
  }),
  'fraud-escalation-alert': (data) => ({
    subject: 'ALERT: Fraud Escalation Detected',
    html: `<p>A record has been escalated for fraud review. Admission ID: ${data.admissionId}, Risk Score: ${data.riskScore}</p>`,
  }),
};

export async function sendEmail(
  to: string,
  template: EmailTemplate,
  data: Record<string, unknown>,
): Promise<{ sent: boolean; error?: string }> {
  const templateFn = TEMPLATES[template];
  if (!templateFn) {
    return { sent: false, error: `Unknown template: ${template}` };
  }

  const { subject, html } = templateFn(data);

  if (config.NODE_ENV === 'test' || !config.SMTP_HOST || config.SMTP_HOST === 'localhost') {
    return { sent: true };
  }

  try {
    const nodemailer = await (Function('return import("nodemailer")')() as Promise<any>);
    const transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: config.SMTP_FROM,
      to,
      subject,
      html,
    });

    return { sent: true };
  } catch {
    return { sent: false, error: 'Email delivery failed' };
  }
}
