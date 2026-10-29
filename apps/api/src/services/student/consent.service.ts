import { prisma } from '../../lib/prisma.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { notificationQueue } from '../../lib/queues.js';

export async function getConsents(studentId: string) {
  const consents = await prisma.consent.findMany({
    where: { student_id: studentId },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      type: true,
      scope: true,
      granted_to: true,
      status: true,
      granted_at: true,
      revoked_at: true,
      expires_at: true,
      created_at: true,
    },
  });

  return consents.map((c: typeof consents[number]) => ({
    id: c.id,
    type: c.type,
    scope: c.scope,
    grantedTo: c.granted_to,
    status: c.status,
    grantedAt: c.granted_at.toISOString(),
    revokedAt: c.revoked_at?.toISOString() ?? null,
    expiresAt: c.expires_at?.toISOString() ?? null,
    createdAt: c.created_at.toISOString(),
  }));
}

export async function grantConsent(
  studentId: string,
  scope: string,
  grantedTo: string,
  ipAddress?: string,
): Promise<{ consentId: string }> {
  const existing = await prisma.consent.findFirst({
    where: {
      student_id: studentId,
      scope,
      granted_to: grantedTo,
      status: 'GRANTED',
    },
    select: { id: true },
  });

  if (existing) {
    return { consentId: existing.id };
  }

  const consent = await prisma.consent.create({
    data: {
      student_id: studentId,
      type: scope === 'EMPLOYER' ? 'EMPLOYER_ACCESS' : 'DATA_SHARING',
      scope,
      granted_to: grantedTo,
      status: 'GRANTED',
      ip_address: ipAddress ?? null,
    },
    select: { id: true },
  });

  await writeAuditEvent({
    actorId: studentId,
    action: 'CONSENT_GRANT',
    targetTable: 'consents',
    targetId: consent.id,
    newValue: { scope, grantedTo },
  });

  return { consentId: consent.id };
}

export async function revokeConsent(
  studentId: string,
  consentId: string,
): Promise<{ revoked: boolean; error?: string }> {
  const consent = await prisma.consent.findFirst({
    where: { id: consentId, student_id: studentId, status: 'GRANTED' },
    select: { id: true, scope: true, granted_to: true },
  });

  if (!consent) {
    return { revoked: false, error: 'Consent not found or already revoked' };
  }

  await prisma.consent.update({
    where: { id: consentId },
    data: { status: 'REVOKED', revoked_at: new Date() },
  });

  await writeAuditEvent({
    actorId: studentId,
    action: 'CONSENT_REVOKE',
    targetTable: 'consents',
    targetId: consentId,
    oldValue: { status: 'GRANTED' },
    newValue: { status: 'REVOKED' },
  });

  if (consent.granted_to) {
    await notificationQueue.add(`revoke-${consentId}`, {
      type: 'employer_access_revoked',
      consentId,
      studentId,
      grantedTo: consent.granted_to,
      scope: consent.scope,
    });
  }

  return { revoked: true };
}

export async function checkConsent(
  studentId: string,
  scope: string,
  requestorId: string,
): Promise<boolean> {
  const consent = await prisma.consent.findFirst({
    where: {
      student_id: studentId,
      scope,
      granted_to: requestorId,
      status: 'GRANTED',
    },
    select: { id: true, expires_at: true },
  });

  if (!consent) return false;

  if (consent.expires_at && consent.expires_at < new Date()) {
    await prisma.consent.update({
      where: { id: consent.id },
      data: { status: 'REVOKED', revoked_at: new Date() },
    });
    return false;
  }

  return true;
}
