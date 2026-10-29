import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockS3 } = vi.hoisted(() => ({
  mockPrisma: {
    institution: { findMany: vi.fn() },
    admission: { count: vi.fn(), groupBy: vi.fn() },
    programme: { findMany: vi.fn() },
    scheduledReport: { create: vi.fn(), findMany: vi.fn() },
  },
  mockS3: {
    putObject: vi.fn(),
    getSignedUrl: vi.fn(),
  },
}));

vi.mock('../../../lib/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../lib/s3.js', () => ({ s3: mockS3 }));
vi.mock('../../../config.js', () => ({ config: { NODE_ENV: 'test' } }));

import {
  buildReportData,
  generateReport,
  exportPdf,
  scheduleReport,
  listScheduledReports,
} from '../report.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockS3.putObject.mockResolvedValue(undefined);
  mockS3.getSignedUrl.mockReturnValue('https://s3.example.com/report');
});

describe('buildReportData', () => {
  it('builds STATE_WISE report', async () => {
    mockPrisma.institution.findMany.mockResolvedValue([{ state: 'Delhi' }, { state: 'Maharashtra' }]);
    mockPrisma.admission.count
      .mockResolvedValueOnce(500)  // Delhi total
      .mockResolvedValueOnce(400)  // Delhi verified
      .mockResolvedValueOnce(10)   // Delhi flagged
      .mockResolvedValueOnce(2)    // Delhi fraud
      .mockResolvedValueOnce(300)  // MH total
      .mockResolvedValueOnce(250)  // MH verified
      .mockResolvedValueOnce(5)    // MH flagged
      .mockResolvedValueOnce(1);   // MH fraud

    const result = await buildReportData({ reportType: 'STATE_WISE' });
    expect(result.title).toContain('State-wise');
    expect(result.rows).toHaveLength(2);
    expect(result.summary.totalRecords).toBe(800);
  });

  it('builds TREND report', async () => {
    mockPrisma.admission.groupBy.mockResolvedValue([
      { academic_year: '2024-25', _count: { id: 1000 } },
      { academic_year: '2025-26', _count: { id: 1500 } },
    ]);
    mockPrisma.admission.count.mockResolvedValue(100);

    const result = await buildReportData({ reportType: 'TREND' });
    expect(result.title).toContain('Trend');
    expect(result.rows).toHaveLength(2);
  });

  it('builds PROGRAMME_WISE report', async () => {
    mockPrisma.programme.findMany.mockResolvedValue([
      { code: 'BTECH', name: 'B.Tech' },
    ]);
    mockPrisma.admission.count
      .mockResolvedValueOnce(200)  // total
      .mockResolvedValueOnce(180)  // verified
      .mockResolvedValueOnce(5)    // flagged
      .mockResolvedValueOnce(1);   // fraud

    const result = await buildReportData({ reportType: 'PROGRAMME_WISE' });
    expect(result.title).toContain('Programme-wise');
    expect(result.rows).toHaveLength(1);
  });

  it('builds INSTITUTION_WISE report', async () => {
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'inst-1', name: 'IIT Delhi' },
    ]);
    mockPrisma.admission.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(90)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0);

    const result = await buildReportData({ reportType: 'INSTITUTION_WISE' });
    expect(result.title).toContain('Institution-wise');
    expect(result.rows[0].label).toBe('IIT Delhi');
  });
});

describe('generateReport', () => {
  it('delegates to buildReportData', async () => {
    mockPrisma.admission.groupBy.mockResolvedValue([]);
    const result = await generateReport({ reportType: 'TREND' });
    expect(result).toHaveProperty('title');
  });
});

describe('exportPdf', () => {
  it('exports report as HTML/PDF to S3', async () => {
    const reportData = {
      title: 'Test Report',
      generatedAt: new Date().toISOString(),
      filters: { reportType: 'STATE_WISE' },
      summary: { totalRecords: 100, totalVerified: 80, overallCoverage: 80 },
      rows: [{ label: 'Delhi', total: 100, verified: 80, apaarCoverage: 80, flagged: 5, fraudEscalations: 1 }],
    };

    const result = await exportPdf(reportData);
    expect(result).toHaveProperty('url');
    expect(mockS3.putObject).toHaveBeenCalled();
  });
});

describe('scheduleReport', () => {
  it('creates scheduled report', async () => {
    mockPrisma.scheduledReport.create.mockResolvedValue({ id: 'sched-1' });

    const result = await scheduleReport(
      { reportType: 'STATE_WISE' },
      '0 0 * * MON',
      ['admin@aicte.gov.in'],
      'officer-1',
    );
    expect(result.scheduleId).toBe('sched-1');
  });
});

describe('listScheduledReports', () => {
  it('returns active scheduled reports for user', async () => {
    mockPrisma.scheduledReport.findMany.mockResolvedValue([
      { id: 'sched-1', report_type: 'STATE_WISE', filters: {}, cron_expression: '0 0 * * MON', recipient_emails: ['a@b.com'], last_run_at: null, created_at: new Date() },
    ]);

    const result = await listScheduledReports('officer-1');
    expect(result).toHaveLength(1);
  });
});
