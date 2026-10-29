import { prisma } from '../../lib/prisma.js';
import { AICTE_REGION_STATES } from './constants.js';

export async function getStats(region?: string) {
  const stateFilter = region && AICTE_REGION_STATES[region]
    ? { institution: { state: { in: [...AICTE_REGION_STATES[region]] } } }
    : {};

  const institutionWhere = region && AICTE_REGION_STATES[region]
    ? { state: { in: [...AICTE_REGION_STATES[region]] } }
    : {};

  const [
    totalInstitutions,
    totalStudents,
    verifiedStudents,
    pendingApprovals,
    flaggedRecords,
    fraudEscalations,
    intakeViolations,
    duplicatePairsOpen,
  ] = await Promise.all([
    prisma.institution.count({ where: institutionWhere }),
    prisma.admission.count({ where: stateFilter }),
    prisma.admission.count({ where: { ...stateFilter, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } } }),
    prisma.admission.count({ where: { ...stateFilter, verification_status: 'submitted_to_aicte' } }),
    prisma.admission.count({ where: { ...stateFilter, verification_status: 'student_flagged' } }),
    prisma.admission.count({ where: { ...stateFilter, verification_status: 'fraud_escalation' } }),
    prisma.admission.count({ where: { ...stateFilter, verification_status: 'intake_exceeded' } }),
    prisma.duplicatePair.count({ where: { status: 'OPEN' } }),
  ]);

  const apaarCoveragePct = totalStudents > 0
    ? Math.round((verifiedStudents / totalStudents) * 10000) / 100
    : 0;

  return {
    total_institutions: totalInstitutions,
    total_students: totalStudents,
    verified_students: verifiedStudents,
    apaar_coverage_pct: apaarCoveragePct,
    pending_approvals: pendingApprovals,
    flagged_records: flaggedRecords,
    fraud_escalations: fraudEscalations,
    intake_violations: intakeViolations,
    duplicate_pairs_open: duplicatePairsOpen,
  };
}

export async function getRegionalBreakdown() {
  const regions = Object.keys(AICTE_REGION_STATES);
  const breakdown = await Promise.all(
    regions.map(async (region) => {
      const stats = await getStats(region);
      return { region, ...stats };
    }),
  );
  return breakdown;
}

export async function getStatewiseStats(region: string) {
  const states = AICTE_REGION_STATES[region];
  if (!states) return { error: 'Invalid region' };

  const stateStats = await Promise.all(
    states.map(async (state: string) => {
      const [totalInstitutions, totalStudents, verifiedStudents] = await Promise.all([
        prisma.institution.count({ where: { state } }),
        prisma.admission.count({ where: { institution: { state } } }),
        prisma.admission.count({ where: { institution: { state }, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } } }),
      ]);

      return {
        state,
        total_institutions: totalInstitutions,
        total_students: totalStudents,
        verified_students: verifiedStudents,
        apaar_coverage_pct: totalStudents > 0
          ? Math.round((verifiedStudents / totalStudents) * 10000) / 100
          : 0,
      };
    }),
  );

  return { region, states: stateStats };
}

export async function getTrendData(
  metric: string,
  period: string,
) {
  const validMetrics = ['enrolment', 'verified', 'apaar_coverage', 'intake_utilisation'];
  if (!validMetrics.includes(metric)) {
    return { error: `Invalid metric. Valid: ${validMetrics.join(', ')}` };
  }

  const academicYears = await prisma.admission.groupBy({
    by: ['academic_year'],
    _count: { id: true },
    orderBy: { academic_year: 'asc' },
  });

  const trends = await Promise.all(
    academicYears.map(async (ay: typeof academicYears[number]) => {
      const year = ay.academic_year;
      const total = ay._count.id;

      if (metric === 'enrolment') {
        return { period: year, value: total };
      }

      if (metric === 'verified') {
        const verified = await prisma.admission.count({
          where: { academic_year: year, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } },
        });
        return { period: year, value: verified };
      }

      if (metric === 'apaar_coverage') {
        const verified = await prisma.admission.count({
          where: { academic_year: year, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } },
        });
        return { period: year, value: total > 0 ? Math.round((verified / total) * 10000) / 100 : 0 };
      }

      // intake_utilisation
      const intakeExceeded = await prisma.admission.count({
        where: { academic_year: year, verification_status: 'intake_exceeded' },
      });
      return { period: year, value: total > 0 ? Math.round((intakeExceeded / total) * 10000) / 100 : 0 };
    }),
  );

  return { metric, period, trends };
}

export async function getAnomalyAlerts() {
  const alerts = await prisma.admission.findMany({
    where: {
      verification_status: { in: ['fraud_escalation', 'anomaly_watch', 'duplicate_flagged'] },
    },
    orderBy: { anomaly_score: 'desc' },
    take: 100,
    select: {
      id: true,
      apaar_id: true,
      academic_year: true,
      verification_status: true,
      anomaly_score: true,
      anomaly_flags: true,
      created_at: true,
      institution: { select: { id: true, name: true, state: true } },
      student: { select: { name: true } },
      programme: { select: { name: true, code: true } },
    },
  });

  return alerts.map((a: typeof alerts[number]) => ({
    id: a.id,
    apaarId: a.apaar_id.slice(0, 4) + '****' + a.apaar_id.slice(-2),
    academicYear: a.academic_year,
    status: a.verification_status,
    anomalyScore: a.anomaly_score,
    anomalyFlags: a.anomaly_flags,
    institution: { id: a.institution.id, name: a.institution.name, state: a.institution.state },
    studentName: a.student.name,
    programme: `${a.programme.name} (${a.programme.code})`,
    createdAt: a.created_at.toISOString(),
  }));
}

export async function getIntakeViolations() {
  const violations = await prisma.admission.findMany({
    where: { verification_status: 'intake_exceeded' },
    orderBy: { created_at: 'desc' },
    take: 200,
    select: {
      id: true,
      apaar_id: true,
      academic_year: true,
      created_at: true,
      institution: { select: { id: true, name: true, state: true, approved_intake: true } },
      programme: { select: { name: true, code: true, approved_intake: true } },
    },
  });

  return violations.map((v: typeof violations[number]) => ({
    id: v.id,
    apaarId: v.apaar_id.slice(0, 4) + '****' + v.apaar_id.slice(-2),
    academicYear: v.academic_year,
    institution: { id: v.institution.id, name: v.institution.name, state: v.institution.state },
    programme: { name: v.programme.name, code: v.programme.code, approvedIntake: v.programme.approved_intake },
    createdAt: v.created_at.toISOString(),
  }));
}
