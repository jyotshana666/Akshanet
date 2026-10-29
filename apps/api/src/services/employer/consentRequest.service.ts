import { randomBytes } from 'node:crypto';
import { type PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
import { redis } from '../../lib/redis.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { notificationQueue } from '../../lib/queues.js';

const REQUEST_EXPIRY_HOURS = 72;
const MAX_REQUESTS_PER_DAY = 5;

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function requestConsent(
  employerId: string,
  apaarId: string,
  purpose: string,
): Promise<{ requestId: string; token: string } | { error: string }> {
  const employer = await prisma.employer.findUnique({
    where: { id: employerId },
    select: { id: true, status: true, company_name: true },
  });

  if (!employer || employer.status !== 'APPROVED') {
    return { error: 'Employer not found or not approved' };
  }

  const student = await prisma.student.findFirst({
    where: { apaar_id: apaarId },
    select: { id: true },
  });

  if (!student) {
    return { error: 'Student not found for given APAAR ID' };
  }

  const blocked = await prisma.employerBlock.findUnique({
    where: { student_id_employer_id: { student_id: student.id, employer_id: employerId } },
    select: { id: true },
  });

  if (blocked) {
    return { error: 'You have been blocked by this student' };
  }

  const rateLimitKey = `employer:consent-rate:${employerId}`;
  const currentCount = await redis.get(rateLimitKey);
  if (currentCount && parseInt(currentCount, 10) >= MAX_REQUESTS_PER_DAY) {
    return { error: 'Daily consent request limit reached (5 per day)' };
  }

  const pendingRequest = await prisma.consentRequest.findFirst({
    where: {
      employer_id: employerId,
      student_id: student.id,
      status: 'PENDING',
      expires_at: { gt: new Date() },
    },
    select: { id: true },
  });

  if (pendingRequest) {
    return { error: 'A pending request already exists for this student' };
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + REQUEST_EXPIRY_HOURS * 60 * 60 * 1000);

  const request = await prisma.consentRequest.create({
    data: {
      employer_id: employerId,
      student_id: student.id,
      apaar_id: apaarId,
      purpose,
      token,
      status: 'PENDING',
      expires_at: expiresAt,
    },
    select: { id: true },
  });

  if (currentCount) {
    await redis.incr(rateLimitKey);
  } else {
    await redis.set(rateLimitKey, '1', 'EX', 86400);
  }

  await writeAuditEvent({
    actorId: employerId,
    action: 'CREATE',
    targetTable: 'consent_requests',
    targetId: request.id,
    newValue: { apaarId, purpose, expiresAt: expiresAt.toISOString() },
  });

  await notificationQueue.add(`consent-request-${request.id}`, {
    type: 'consent_request',
    studentId: student.id,
    employerName: employer.company_name,
    purpose,
    token,
  });

  return { requestId: request.id, token };
}

export async function approveConsentByToken(
  token: string,
  studentId: string,
): Promise<{ approved: boolean; error?: string }> {
  const request = await prisma.consentRequest.findUnique({
    where: { token },
    select: { id: true, student_id: true, employer_id: true, status: true, expires_at: true, apaar_id: true },
  });

  if (!request) {
    return { approved: false, error: 'Consent request not found' };
  }

  if (request.student_id !== studentId) {
    return { approved: false, error: 'This request does not belong to you' };
  }

  if (request.status !== 'PENDING') {
    return { approved: false, error: `Request already ${request.status.toLowerCase()}` };
  }

  if (request.expires_at < new Date()) {
    await prisma.consentRequest.update({
      where: { id: request.id },
      data: { status: 'EXPIRED' },
    });
    return { approved: false, error: 'Request has expired' };
  }

  await prisma.$transaction(async (tx: TxClient) => {
    await tx.consentRequest.update({
      where: { id: request.id },
      data: { status: 'APPROVED', responded_at: new Date() },
    });

    await tx.consent.create({
      data: {
        student_id: studentId,
        type: 'EMPLOYER_ACCESS',
        scope: 'EMPLOYER',
        granted_to: request.employer_id,
        status: 'GRANTED',
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
  });

  await writeAuditEvent({
    actorId: studentId,
    action: 'CONSENT_GRANT',
    targetTable: 'consent_requests',
    targetId: request.id,
    newValue: { employerId: request.employer_id, status: 'APPROVED' },
  });

  return { approved: true };
}

export async function denyConsentByToken(
  token: string,
  studentId: string,
): Promise<{ denied: boolean; error?: string }> {
  const request = await prisma.consentRequest.findUnique({
    where: { token },
    select: { id: true, student_id: true, status: true, expires_at: true },
  });

  if (!request) {
    return { denied: false, error: 'Consent request not found' };
  }

  if (request.student_id !== studentId) {
    return { denied: false, error: 'This request does not belong to you' };
  }

  if (request.status !== 'PENDING') {
    return { denied: false, error: `Request already ${request.status.toLowerCase()}` };
  }

  await prisma.consentRequest.update({
    where: { id: request.id },
    data: { status: 'DENIED', responded_at: new Date() },
  });

  await writeAuditEvent({
    actorId: studentId,
    action: 'CONSENT_REVOKE',
    targetTable: 'consent_requests',
    targetId: request.id,
    newValue: { status: 'DENIED' },
  });

  return { denied: true };
}

export async function getPendingRequests(
  studentId: string,
): Promise<Array<{
  id: string;
  employerName: string;
  purpose: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}>> {
  const requests = await prisma.consentRequest.findMany({
    where: {
      student_id: studentId,
      status: 'PENDING',
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      purpose: true,
      token: true,
      expires_at: true,
      created_at: true,
      employer: { select: { company_name: true } },
    },
  });

  return requests.map((r: typeof requests[number]) => ({
    id: r.id,
    employerName: r.employer.company_name,
    purpose: r.purpose,
    token: r.token,
    expiresAt: r.expires_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  }));
}

export async function getRequestHistory(
  employerId: string,
  page: number,
  limit: number,
): Promise<{
  requests: Array<{
    id: string;
    apaarId: string;
    purpose: string;
    status: string;
    createdAt: string;
    respondedAt: string | null;
  }>;
  total: number;
}> {
  const [requests, total] = await Promise.all([
    prisma.consentRequest.findMany({
      where: { employer_id: employerId },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        apaar_id: true,
        purpose: true,
        status: true,
        created_at: true,
        responded_at: true,
      },
    }),
    prisma.consentRequest.count({ where: { employer_id: employerId } }),
  ]);

  return {
    requests: requests.map((r: typeof requests[number]) => ({
      id: r.id,
      apaarId: r.apaar_id.slice(0, 4) + '****' + r.apaar_id.slice(-2),
      purpose: r.purpose,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      respondedAt: r.responded_at?.toISOString() ?? null,
    })),
    total,
  };
}

export async function expireOutdatedRequests(): Promise<number> {
  const result = await prisma.consentRequest.updateMany({
    where: {
      status: 'PENDING',
      expires_at: { lte: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  return result.count;
}
