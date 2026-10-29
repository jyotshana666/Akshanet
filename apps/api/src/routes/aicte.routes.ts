import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  getStats,
  getRegionalBreakdown,
  getStatewiseStats,
  getTrendData,
  getAnomalyAlerts,
  getIntakeViolations,
} from '../services/aicte/dashboard.service.js';
import {
  getApprovalQueue,
  getInstitutionDetail,
  approveInstitution,
  rejectInstitution,
} from '../services/aicte/approval.service.js';
import {
  generateRejectionLetter,
  sendLetter,
} from '../services/aicte/letter.service.js';
import {
  generateReport,
  exportPdf,
  exportExcel,
  scheduleReport,
  listScheduledReports,
} from '../services/aicte/report.service.js';

export const aicteRouter: RouterType = Router();

aicteRouter.use(authenticate, requireRole('AICTE_ADMIN', 'AICTE_REVIEWER'));

// ── Dashboard ──────────────────────────────────────────────

aicteRouter.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    const region = req.query.region as string | undefined;
    const stats = await getStats(region);
    res.json(stats);
  }),
);

aicteRouter.get(
  '/dashboard/regional-breakdown',
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role !== 'AICTE_ADMIN') {
      res.status(403).json({ error: 'National-level access required' });
      return;
    }
    const breakdown = await getRegionalBreakdown();
    res.json({ regions: breakdown });
  }),
);

aicteRouter.get(
  '/dashboard/statewise/:region',
  asyncHandler(async (req: Request, res: Response) => {
    const region = req.params.region as string;
    const result = await getStatewiseStats(region);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  }),
);

aicteRouter.get(
  '/dashboard/trends',
  asyncHandler(async (req: Request, res: Response) => {
    const metric = (req.query.metric as string) ?? 'enrolment';
    const period = (req.query.period as string) ?? 'yearly';
    const result = await getTrendData(metric, period);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  }),
);

aicteRouter.get(
  '/dashboard/anomalies',
  asyncHandler(async (_req: Request, res: Response) => {
    const alerts = await getAnomalyAlerts();
    res.json({ alerts });
  }),
);

aicteRouter.get(
  '/dashboard/intake-violations',
  asyncHandler(async (_req: Request, res: Response) => {
    const violations = await getIntakeViolations();
    res.json({ violations });
  }),
);

// ── Approvals ──────────────────────────────────────────────

aicteRouter.get(
  '/approvals',
  asyncHandler(async (req: Request, res: Response) => {
    const region = req.user!.role === 'AICTE_REVIEWER' ? (req.query.region as string ?? null) : null;
    const filters = {
      state: req.query.state as string | undefined,
      programme: req.query.programme as string | undefined,
      intakeViolation: req.query.intake_violation === 'true',
      apaarCoverageBelow: req.query.apaar_coverage_below ? parseFloat(req.query.apaar_coverage_below as string) : undefined,
    };
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const result = await getApprovalQueue(region, filters, page, limit);
    res.json(result);
  }),
);

aicteRouter.get(
  '/approvals/:institutionId',
  asyncHandler(async (req: Request, res: Response) => {
    const institutionId = req.params.institutionId as string;
    const result = await getInstitutionDetail(institutionId);
    if ('error' in result) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json(result);
  }),
);

const approveSchema = z.object({
  academicYear: z.string().min(4),
});

aicteRouter.post(
  '/approvals/:institutionId/approve',
  validate(approveSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const institutionId = req.params.institutionId as string;
    const officerRegion = req.user!.role === 'AICTE_REVIEWER' ? (req.query.region as string ?? null) : null;
    const result = await approveInstitution(
      institutionId,
      req.user!.sub,
      req.body.academicYear,
      officerRegion,
    );
    if (!result.approved) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Institution approved', recordCount: result.recordCount });
  }),
);

const rejectSchema = z.object({
  academicYear: z.string().min(4),
  reasonCodes: z.array(z.string()).min(1),
  customNote: z.string().max(2000).optional(),
});

aicteRouter.post(
  '/approvals/:institutionId/reject',
  validate(rejectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const institutionId = req.params.institutionId as string;
    const officerRegion = req.user!.role === 'AICTE_REVIEWER' ? (req.query.region as string ?? null) : null;
    const result = await rejectInstitution(
      institutionId,
      req.user!.sub,
      req.body.academicYear,
      req.body.reasonCodes,
      req.body.customNote,
      officerRegion,
    );
    if (!result.rejected) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Institution rejected', rejectionId: result.rejectionId });
  }),
);

// ── Letters ────────────────────────────────────────────────

aicteRouter.get(
  '/letters/:rejectionId',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await generateRejectionLetter(req.params.rejectionId as string);
    if ('error' in result) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json(result);
  }),
);

const sendLetterSchema = z.object({
  type: z.enum(['approval', 'rejection']),
  recipientEmails: z.array(z.string().email()).min(1),
});

aicteRouter.post(
  '/letters/:recordId/send',
  validate(sendLetterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await sendLetter(
      req.params.recordId as string,
      req.body.type,
      req.body.recipientEmails,
    );
    if (!result.sent) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Letter sent' });
  }),
);

// ── Reports ────────────────────────────────────────────────

aicteRouter.get(
  '/reports',
  asyncHandler(async (req: Request, res: Response) => {
    const reports = await listScheduledReports(req.user!.sub);
    res.json({ reports });
  }),
);

const generateReportSchema = z.object({
  reportType: z.enum(['STATE_WISE', 'PROGRAMME_WISE', 'QUOTA_WISE', 'INSTITUTION_WISE', 'TREND']),
  region: z.string().optional(),
  state: z.string().optional(),
  programme: z.string().optional(),
  academicYear: z.string().optional(),
  format: z.enum(['json', 'pdf', 'excel']).default('json'),
});

aicteRouter.post(
  '/reports/generate',
  validate(generateReportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { format, ...filters } = req.body;
    const reportData = await generateReport(filters);

    if (format === 'pdf') {
      const result = await exportPdf(reportData);
      res.json(result);
      return;
    }

    if (format === 'excel') {
      const result = await exportExcel(reportData);
      res.json(result);
      return;
    }

    res.json(reportData);
  }),
);

const scheduleReportSchema = z.object({
  reportType: z.enum(['STATE_WISE', 'PROGRAMME_WISE', 'QUOTA_WISE', 'INSTITUTION_WISE', 'TREND']),
  region: z.string().optional(),
  state: z.string().optional(),
  programme: z.string().optional(),
  academicYear: z.string().optional(),
  cronExpression: z.string().min(1),
  recipientEmails: z.array(z.string().email()).min(1),
});

aicteRouter.post(
  '/reports/schedule',
  validate(scheduleReportSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { cronExpression, recipientEmails, ...filters } = req.body;
    const result = await scheduleReport(
      filters,
      cronExpression,
      recipientEmails,
      req.user!.sub,
    );
    res.status(201).json(result);
  }),
);
