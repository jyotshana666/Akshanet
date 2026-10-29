import { createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { writeAuditEvent } from '../../lib/audit.js';

const CIN_REGEX = /^[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;

function validateCin(cin: string): boolean {
  return CIN_REGEX.test(cin);
}

export async function registerEmployer(
  userId: string,
  data: {
    companyName: string;
    cin: string;
    industry: string;
    website?: string;
    contactName: string;
    contactEmail: string;
  },
): Promise<{ employerId: string } | { error: string }> {
  if (!validateCin(data.cin)) {
    return { error: 'Invalid CIN format' };
  }

  const existing = await prisma.employer.findFirst({
    where: { user_id: userId },
    select: { id: true, status: true },
  });

  if (existing) {
    return { error: `Registration already exists (status: ${existing.status})` };
  }

  const cinTaken = await prisma.employer.findUnique({
    where: { cin: data.cin },
    select: { id: true },
  });

  if (cinTaken) {
    return { error: 'CIN already registered' };
  }

  const contactEmailHash = createHash('sha256').update(data.contactEmail).digest('hex');

  const employer = await prisma.employer.create({
    data: {
      user_id: userId,
      company_name: data.companyName,
      cin: data.cin,
      industry: data.industry,
      website: data.website ?? null,
      contact_name: data.contactName,
      contact_email_hash: contactEmailHash,
      status: 'PENDING',
    },
    select: { id: true },
  });

  await writeAuditEvent({
    actorId: userId,
    action: 'CREATE',
    targetTable: 'employers',
    targetId: employer.id,
    newValue: { companyName: data.companyName, cin: data.cin, status: 'PENDING' },
  });

  return { employerId: employer.id };
}

export async function approveEmployer(
  employerId: string,
  approvedBy: string,
): Promise<{ approved: boolean; error?: string }> {
  const employer = await prisma.employer.findUnique({
    where: { id: employerId },
    select: { id: true, status: true, user_id: true },
  });

  if (!employer) {
    return { approved: false, error: 'Employer not found' };
  }

  if (employer.status !== 'PENDING') {
    return { approved: false, error: `Cannot approve employer in ${employer.status} status` };
  }

  await prisma.employer.update({
    where: { id: employerId },
    data: { status: 'APPROVED', approved_by: approvedBy, approved_at: new Date() },
  });

  await writeAuditEvent({
    actorId: approvedBy,
    action: 'APPROVE',
    targetTable: 'employers',
    targetId: employerId,
    oldValue: { status: 'PENDING' },
    newValue: { status: 'APPROVED' },
  });

  return { approved: true };
}

export async function rejectEmployer(
  employerId: string,
  rejectedBy: string,
  reason: string,
): Promise<{ rejected: boolean; error?: string }> {
  const employer = await prisma.employer.findUnique({
    where: { id: employerId },
    select: { id: true, status: true },
  });

  if (!employer) {
    return { rejected: false, error: 'Employer not found' };
  }

  if (employer.status !== 'PENDING') {
    return { rejected: false, error: `Cannot reject employer in ${employer.status} status` };
  }

  await prisma.employer.update({
    where: { id: employerId },
    data: { status: 'REJECTED', rejected_reason: reason },
  });

  await writeAuditEvent({
    actorId: rejectedBy,
    action: 'REJECT',
    targetTable: 'employers',
    targetId: employerId,
    oldValue: { status: 'PENDING' },
    newValue: { status: 'REJECTED', reason },
  });

  return { rejected: true };
}

export async function getEmployerStatus(
  userId: string,
): Promise<{
  registered: boolean;
  employerId?: string;
  companyName?: string;
  status?: string;
}> {
  const employer = await prisma.employer.findFirst({
    where: { user_id: userId },
    select: { id: true, company_name: true, status: true, cin: true, industry: true },
  });

  if (!employer) {
    return { registered: false };
  }

  return {
    registered: true,
    employerId: employer.id,
    companyName: employer.company_name,
    status: employer.status,
  };
}

export async function getPendingEmployers(
  page: number,
  limit: number,
): Promise<{
  employers: Array<{
    id: string;
    companyName: string;
    cin: string;
    industry: string;
    contactName: string;
    createdAt: string;
  }>;
  total: number;
}> {
  const [employers, total] = await Promise.all([
    prisma.employer.findMany({
      where: { status: 'PENDING' },
      orderBy: { created_at: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        company_name: true,
        cin: true,
        industry: true,
        contact_name: true,
        created_at: true,
      },
    }),
    prisma.employer.count({ where: { status: 'PENDING' } }),
  ]);

  return {
    employers: employers.map((e: typeof employers[number]) => ({
      id: e.id,
      companyName: e.company_name,
      cin: e.cin,
      industry: e.industry,
      contactName: e.contact_name,
      createdAt: e.created_at.toISOString(),
    })),
    total,
  };
}
