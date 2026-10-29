import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { transition } from '../../lib/stateMachine.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { notificationQueue } from '../../lib/queues.js';
import { getRegionForState, REJECTION_REASON_CODES } from './constants.js';

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

interface ApprovalQueueFilters {
  state?: string;
  programme?: string;
  intakeViolation?: boolean;
  apaarCoverageBelow?: number;
}

export async function getApprovalQueue(
  region: string | null,
  filters: ApprovalQueueFilters,
  page: number,
  limit: number,
) {
  const institutionWhere: Record<string, unknown> = {};
  if (region) {
    const { getRegionForState: _, ...rest } = await import('./constants.js');
    const regionStates = rest.AICTE_REGION_STATES[region];
    if (regionStates) {
      institutionWhere.state = { in: [...regionStates] };
    }
  }
  if (filters.state) {
    institutionWhere.state = filters.state;
  }

  const institutions = await prisma.institution.findMany({
    where: { ...institutionWhere, is_active: true },
    select: { id: true, name: true, state: true, aicte_id: true },
  });

  const results = await Promise.all(
    institutions.map(async (inst: typeof institutions[number]) => {
      const baseWhere = { institution_id: inst.id, verification_status: 'submitted_to_aicte' as const };

      const submittedCount = await prisma.admission.count({ where: baseWhere });
      if (submittedCount === 0) return null;

      const [totalAdmissions, verifiedCount, flaggedCount, fraudCount, intakeViolationCount] = await Promise.all([
        prisma.admission.count({ where: { institution_id: inst.id } }),
        prisma.admission.count({ where: { institution_id: inst.id, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } } }),
        prisma.admission.count({ where: { institution_id: inst.id, verification_status: 'student_flagged' } }),
        prisma.admission.count({ where: { institution_id: inst.id, verification_status: 'fraud_escalation' } }),
        prisma.admission.count({ where: { institution_id: inst.id, verification_status: 'intake_exceeded' } }),
      ]);

      const apaarCoveragePct = totalAdmissions > 0
        ? Math.round((verifiedCount / totalAdmissions) * 10000) / 100
        : 0;

      if (filters.intakeViolation && intakeViolationCount === 0) return null;
      if (filters.apaarCoverageBelow !== undefined && apaarCoveragePct >= filters.apaarCoverageBelow) return null;

      const latestSubmission = await prisma.admission.findFirst({
        where: baseWhere,
        orderBy: { submitted_at: 'asc' },
        select: { submitted_at: true },
      });

      return {
        institutionId: inst.id,
        name: inst.name,
        state: inst.state,
        aicteId: inst.aicte_id,
        submittedCount,
        verifiedCount,
        flaggedCount,
        fraudCount,
        apaarCoveragePct,
        intakeViolationCount,
        submissionDate: latestSubmission?.submitted_at?.toISOString() ?? null,
      };
    }),
  );

  const filtered = results.filter(Boolean) as NonNullable<(typeof results)[number]>[];
  filtered.sort((a, b) => (a!.submissionDate ?? '').localeCompare(b!.submissionDate ?? ''));

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return { institutions: paginated, total };
}

export async function getInstitutionDetail(institutionId: string) {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: {
      id: true, name: true, state: true, district: true, type: true,
      aicte_id: true, approved_intake: true, is_active: true,
    },
  });

  if (!institution) return { error: 'Institution not found' };

  const [totalAdmissions, verifiedCount, unverifiedSubmitted, flaggedCount, fraudCount, intakeViolationCount, duplicatePairsOpen] = await Promise.all([
    prisma.admission.count({ where: { institution_id: institutionId } }),
    prisma.admission.count({ where: { institution_id: institutionId, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } } }),
    prisma.admission.count({ where: { institution_id: institutionId, verification_status: 'submitted_to_aicte' } }),
    prisma.admission.count({ where: { institution_id: institutionId, verification_status: 'student_flagged' } }),
    prisma.admission.count({ where: { institution_id: institutionId, verification_status: 'fraud_escalation' } }),
    prisma.admission.count({ where: { institution_id: institutionId, verification_status: 'intake_exceeded' } }),
    prisma.duplicatePair.count({ where: { status: 'OPEN' } }),
  ]);

  const apaarCoveragePct = totalAdmissions > 0
    ? Math.round((verifiedCount / totalAdmissions) * 10000) / 100
    : 0;

  const statusDistribution = await prisma.admission.groupBy({
    by: ['verification_status'],
    where: { institution_id: institutionId },
    _count: { id: true },
  });

  const programmes = await prisma.programme.findMany({
    where: { institution_id: institutionId },
    select: { id: true, name: true, code: true, approved_intake: true, academic_year: true },
  });

  const intakeData = await Promise.all(
    programmes.map(async (p: typeof programmes[number]) => {
      const enrolled = await prisma.admission.count({
        where: { programme_id: p.id, verification_status: { notIn: ['rejected', 'withdrawn'] } },
      });
      return {
        programme: p.name,
        code: p.code,
        approvedIntake: p.approved_intake,
        enrolled,
        utilisation: p.approved_intake > 0 ? Math.round((enrolled / p.approved_intake) * 10000) / 100 : 0,
      };
    }),
  );

  const checklist = {
    apaarCoverage100: apaarCoveragePct === 100,
    noDuplicates: duplicatePairsOpen === 0,
    noIntakeExceeded: intakeViolationCount === 0,
    noFraudEscalations: fraudCount === 0,
    allStudentsVerified: unverifiedSubmitted === 0 || verifiedCount === totalAdmissions,
  };

  return {
    institution,
    stats: {
      totalAdmissions,
      verifiedCount,
      flaggedCount,
      fraudCount,
      intakeViolationCount,
      duplicatePairsOpen,
      apaarCoveragePct,
    },
    checklist,
    statusDistribution: statusDistribution.map((s: typeof statusDistribution[number]) => ({
      status: s.verification_status,
      count: s._count.id,
    })),
    intakeData,
  };
}

export async function approveInstitution(
  institutionId: string,
  aicteOfficerId: string,
  academicYear: string,
  officerRegion: string | null,
): Promise<{ approved: boolean; recordCount?: number; error?: string }> {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { id: true, state: true, name: true },
  });

  if (!institution) return { approved: false, error: 'Institution not found' };

  if (officerRegion) {
    const instRegion = getRegionForState(institution.state);
    if (instRegion !== officerRegion) {
      return { approved: false, error: 'Institution not in your region' };
    }
  }

  const records = await prisma.admission.findMany({
    where: { institution_id: institutionId, verification_status: 'submitted_to_aicte', academic_year: academicYear },
    select: { id: true, verification_status: true },
  });

  if (records.length === 0) {
    return { approved: false, error: 'No submitted records found for this institution and year' };
  }

  await prisma.$transaction(async (tx: TxClient) => {
    for (const record of records) {
      await transition(tx, record.id, 'aicte_approved', aicteOfficerId, 'AICTE_ADMIN');
    }
  });

  await prisma.approvalRecord.create({
    data: {
      institution_id: institutionId,
      academic_year: academicYear,
      approved_by: aicteOfficerId,
      record_count: records.length,
    },
  });

  await writeAuditEvent({
    actorId: aicteOfficerId,
    institutionId,
    action: 'APPROVE',
    targetTable: 'institutions',
    targetId: institutionId,
    newValue: { academicYear, recordCount: records.length },
  });

  await notificationQueue.add(`approval-${institutionId}-${academicYear}`, {
    type: 'institution_approved',
    institutionId,
    institutionName: institution.name,
    academicYear,
    recordCount: records.length,
  });

  return { approved: true, recordCount: records.length };
}

export async function rejectInstitution(
  institutionId: string,
  aicteOfficerId: string,
  academicYear: string,
  reasonCodes: string[],
  customNote: string | undefined,
  officerRegion: string | null,
): Promise<{ rejected: boolean; rejectionId?: string; error?: string }> {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { id: true, state: true, name: true },
  });

  if (!institution) return { rejected: false, error: 'Institution not found' };

  if (officerRegion) {
    const instRegion = getRegionForState(institution.state);
    if (instRegion !== officerRegion) {
      return { rejected: false, error: 'Institution not in your region' };
    }
  }

  const invalidCodes = reasonCodes.filter((c) => !REJECTION_REASON_CODES[c]);
  if (invalidCodes.length > 0) {
    return { rejected: false, error: `Invalid reason codes: ${invalidCodes.join(', ')}` };
  }

  const records = await prisma.admission.findMany({
    where: { institution_id: institutionId, verification_status: 'submitted_to_aicte', academic_year: academicYear },
    select: { id: true },
  });

  if (records.length === 0) {
    return { rejected: false, error: 'No submitted records found' };
  }

  await prisma.$transaction(async (tx: TxClient) => {
    for (const record of records) {
      await transition(tx, record.id, 'rejected', aicteOfficerId, 'AICTE_ADMIN');
    }
  });

  const rejection = await prisma.rejectionRecord.create({
    data: {
      institution_id: institutionId,
      academic_year: academicYear,
      rejected_by: aicteOfficerId,
      reason_codes: reasonCodes,
      custom_note: customNote ?? null,
    },
    select: { id: true },
  });

  await writeAuditEvent({
    actorId: aicteOfficerId,
    institutionId,
    action: 'REJECT',
    targetTable: 'institutions',
    targetId: institutionId,
    newValue: { academicYear, reasonCodes, recordCount: records.length },
  });

  await notificationQueue.add(`rejection-${institutionId}-${academicYear}`, {
    type: 'institution_rejected',
    institutionId,
    institutionName: institution.name,
    academicYear,
    reasonCodes,
    rejectionId: rejection.id,
  });

  return { rejected: true, rejectionId: rejection.id };
}
