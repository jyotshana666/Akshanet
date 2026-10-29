import { prisma } from '../../lib/prisma.js';
import { s3 } from '../../lib/s3.js';
import { AICTE_REGION_STATES } from './constants.js';

interface ReportFilters {
  region?: string;
  state?: string;
  programme?: string;
  academicYear?: string;
  reportType: string;
}

interface ReportRow {
  label: string;
  total: number;
  verified: number;
  apaarCoverage: number;
  flagged: number;
  fraudEscalations: number;
}

export async function buildReportData(filters: ReportFilters): Promise<{
  title: string;
  generatedAt: string;
  filters: ReportFilters;
  summary: { totalRecords: number; totalVerified: number; overallCoverage: number };
  rows: ReportRow[];
}> {
  const admissionWhere: Record<string, unknown> = {};
  if (filters.academicYear) admissionWhere.academic_year = filters.academicYear;
  if (filters.state) admissionWhere.institution = { state: filters.state };
  if (filters.region && AICTE_REGION_STATES[filters.region]) {
    admissionWhere.institution = { state: { in: [...AICTE_REGION_STATES[filters.region]] } };
  }

  let rows: ReportRow[] = [];
  let title = '';

  if (filters.reportType === 'STATE_WISE') {
    title = 'State-wise Admission Report';
    const states = filters.region && AICTE_REGION_STATES[filters.region]
      ? [...AICTE_REGION_STATES[filters.region]]
      : (await prisma.institution.findMany({ distinct: ['state'], select: { state: true } })).map((i: { state: string }) => i.state);

    rows = await Promise.all(states.map(async (state: string) => {
      const where = { ...admissionWhere, institution: { state } };
      const [total, verified, flagged, fraud] = await Promise.all([
        prisma.admission.count({ where }),
        prisma.admission.count({ where: { ...where, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } } }),
        prisma.admission.count({ where: { ...where, verification_status: 'student_flagged' } }),
        prisma.admission.count({ where: { ...where, verification_status: 'fraud_escalation' } }),
      ]);
      return { label: state, total, verified, apaarCoverage: total > 0 ? Math.round((verified / total) * 10000) / 100 : 0, flagged, fraudEscalations: fraud };
    }));
  } else if (filters.reportType === 'PROGRAMME_WISE') {
    title = 'Programme-wise Admission Report';
    const programmes = await prisma.programme.findMany({ distinct: ['code'], select: { code: true, name: true } });
    rows = await Promise.all(programmes.map(async (p: typeof programmes[number]) => {
      const where = { ...admissionWhere, programme: { code: p.code } };
      const [total, verified, flagged, fraud] = await Promise.all([
        prisma.admission.count({ where }),
        prisma.admission.count({ where: { ...where, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } } }),
        prisma.admission.count({ where: { ...where, verification_status: 'student_flagged' } }),
        prisma.admission.count({ where: { ...where, verification_status: 'fraud_escalation' } }),
      ]);
      return { label: `${p.name} (${p.code})`, total, verified, apaarCoverage: total > 0 ? Math.round((verified / total) * 10000) / 100 : 0, flagged, fraudEscalations: fraud };
    }));
  } else if (filters.reportType === 'INSTITUTION_WISE') {
    title = 'Institution-wise Admission Report';
    const instWhere: Record<string, unknown> = {};
    if (filters.state) instWhere.state = filters.state;
    if (filters.region && AICTE_REGION_STATES[filters.region]) {
      instWhere.state = { in: [...AICTE_REGION_STATES[filters.region]] };
    }
    const institutions = await prisma.institution.findMany({ where: instWhere, select: { id: true, name: true }, take: 500 });
    rows = await Promise.all(institutions.map(async (inst: typeof institutions[number]) => {
      const where = { institution_id: inst.id, ...(filters.academicYear ? { academic_year: filters.academicYear } : {}) };
      const [total, verified, flagged, fraud] = await Promise.all([
        prisma.admission.count({ where }),
        prisma.admission.count({ where: { ...where, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } } }),
        prisma.admission.count({ where: { ...where, verification_status: 'student_flagged' } }),
        prisma.admission.count({ where: { ...where, verification_status: 'fraud_escalation' } }),
      ]);
      return { label: inst.name, total, verified, apaarCoverage: total > 0 ? Math.round((verified / total) * 10000) / 100 : 0, flagged, fraudEscalations: fraud };
    }));
  } else if (filters.reportType === 'TREND') {
    title = 'Year-over-Year Trend Report';
    const years = await prisma.admission.groupBy({ by: ['academic_year'], _count: { id: true }, orderBy: { academic_year: 'asc' } });
    rows = await Promise.all(years.map(async (y: typeof years[number]) => {
      const where = { academic_year: y.academic_year };
      const [verified, flagged, fraud] = await Promise.all([
        prisma.admission.count({ where: { ...where, verification_status: { in: ['student_verified', 'aicte_approved', 'submitted_to_aicte'] } } }),
        prisma.admission.count({ where: { ...where, verification_status: 'student_flagged' } }),
        prisma.admission.count({ where: { ...where, verification_status: 'fraud_escalation' } }),
      ]);
      return { label: y.academic_year, total: y._count.id, verified, apaarCoverage: y._count.id > 0 ? Math.round((verified / y._count.id) * 10000) / 100 : 0, flagged, fraudEscalations: fraud };
    }));
  } else {
    title = `${filters.reportType} Report`;
    rows = [];
  }

  const totalRecords = rows.reduce((sum, r) => sum + r.total, 0);
  const totalVerified = rows.reduce((sum, r) => sum + r.verified, 0);

  return {
    title,
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      totalRecords,
      totalVerified,
      overallCoverage: totalRecords > 0 ? Math.round((totalVerified / totalRecords) * 10000) / 100 : 0,
    },
    rows,
  };
}

export async function generateReport(filters: ReportFilters) {
  return buildReportData(filters);
}

export async function exportPdf(reportData: Awaited<ReturnType<typeof buildReportData>>): Promise<{ url: string }> {
  const tableRows = reportData.rows.map((r) =>
    `<tr><td>${r.label}</td><td>${r.total}</td><td>${r.verified}</td><td>${r.apaarCoverage}%</td><td>${r.flagged}</td><td>${r.fraudEscalations}</td></tr>`,
  ).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${reportData.title}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 30px; }
  h1 { font-size: 18px; }
  .summary { margin: 15px 0; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
  th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; }
  .footer { font-size: 11px; color: #666; margin-top: 20px; }
</style></head><body>
  <h1>${reportData.title}</h1>
  <p>Generated: ${reportData.generatedAt}</p>
  <div class="summary">
    <strong>Summary:</strong> ${reportData.summary.totalRecords} records,
    ${reportData.summary.totalVerified} verified,
    ${reportData.summary.overallCoverage}% coverage
  </div>
  <table>
    <thead><tr><th>Category</th><th>Total</th><th>Verified</th><th>APAAR Coverage</th><th>Flagged</th><th>Fraud</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">Akshanet — AICTE Student Data Management Platform</div>
</body></html>`;

  const buffer = Buffer.from(html, 'utf-8');
  const key = `reports/${Date.now()}-report.html`;
  await s3.putObject({ key, body: buffer, contentType: 'text/html' });
  return { url: s3.getSignedUrl(key, 3600) };
}

export async function exportExcel(
  reportData: Awaited<ReturnType<typeof buildReportData>>,
): Promise<{ url: string }> {
  const ExcelJS = (await (Function('return import("exceljs")')() as Promise<{ default: typeof import('exceljs') }>)).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(reportData.title.slice(0, 31));

  sheet.columns = [
    { header: 'Category', key: 'label', width: 40 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Verified', key: 'verified', width: 12 },
    { header: 'APAAR Coverage %', key: 'apaarCoverage', width: 16 },
    { header: 'Flagged', key: 'flagged', width: 12 },
    { header: 'Fraud Escalations', key: 'fraudEscalations', width: 18 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

  for (const row of reportData.rows) {
    sheet.addRow(row);
  }

  sheet.addRow({});
  sheet.addRow({ label: 'SUMMARY', total: reportData.summary.totalRecords, verified: reportData.summary.totalVerified, apaarCoverage: reportData.summary.overallCoverage });

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const key = `reports/${Date.now()}-report.xlsx`;
  await s3.putObject({ key, body: buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return { url: s3.getSignedUrl(key, 3600) };
}

export async function scheduleReport(
  reportConfig: ReportFilters,
  cronExpression: string,
  recipientEmails: string[],
  createdBy: string,
): Promise<{ scheduleId: string }> {
  const schedule = await prisma.scheduledReport.create({
    data: {
      report_type: reportConfig.reportType,
      filters: reportConfig as any,
      cron_expression: cronExpression,
      recipient_emails: recipientEmails,
      created_by: createdBy,
    },
    select: { id: true },
  });

  return { scheduleId: schedule.id };
}

export async function listScheduledReports(createdBy: string) {
  return prisma.scheduledReport.findMany({
    where: { created_by: createdBy, is_active: true },
    orderBy: { created_at: 'desc' },
    select: {
      id: true, report_type: true, filters: true,
      cron_expression: true, recipient_emails: true,
      last_run_at: true, created_at: true,
    },
  });
}
