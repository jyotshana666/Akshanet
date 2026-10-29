import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  registerEmployer,
  getEmployerStatus,
  approveEmployer,
  rejectEmployer,
  getPendingEmployers,
} from '../services/employer/registration.service.js';
import {
  requestConsent,
  getRequestHistory,
} from '../services/employer/consentRequest.service.js';
import {
  getVerifiedRecord,
  generateVerificationCertificate,
} from '../services/employer/verification.service.js';
import { prisma } from '../lib/prisma.js';

export const employerRouter: RouterType = Router();

// ── Employer-only routes ────────────────────────────────────

const employerOnly = Router();
employerOnly.use(authenticate, requireRole('EMPLOYER'));

// Register employer profile
const registerSchema = z.object({
  companyName: z.string().min(1).max(200),
  cin: z.string().min(21).max(21),
  industry: z.string().min(1).max(100),
  website: z.string().url().optional(),
  contactName: z.string().min(1).max(100),
  contactEmail: z.string().email(),
});

employerOnly.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await registerEmployer(req.user!.sub, req.body);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  }),
);

// Get registration status
employerOnly.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const status = await getEmployerStatus(req.user!.sub);
    res.json(status);
  }),
);

// Request consent from a student
const consentRequestSchema = z.object({
  apaarId: z.string().length(12),
  purpose: z.string().min(1).max(500),
});

employerOnly.post(
  '/consent/request',
  validate(consentRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const employer = await prisma.employer.findFirst({
      where: { user_id: req.user!.sub, status: 'APPROVED' },
      select: { id: true },
    });

    if (!employer) {
      res.status(403).json({ error: 'Employer not approved' });
      return;
    }

    const result = await requestConsent(employer.id, req.body.apaarId, req.body.purpose);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ requestId: result.requestId });
  }),
);

// Get consent request history
employerOnly.get(
  '/consent/history',
  asyncHandler(async (req: Request, res: Response) => {
    const employer = await prisma.employer.findFirst({
      where: { user_id: req.user!.sub },
      select: { id: true },
    });

    if (!employer) {
      res.status(404).json({ error: 'Employer not found' });
      return;
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const result = await getRequestHistory(employer.id, page, limit);
    res.json(result);
  }),
);

// Access a verified student record
const recordAccessSchema = z.object({
  apaarId: z.string().length(12),
});

employerOnly.post(
  '/record',
  validate(recordAccessSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const employer = await prisma.employer.findFirst({
      where: { user_id: req.user!.sub, status: 'APPROVED' },
      select: { id: true },
    });

    if (!employer) {
      res.status(403).json({ error: 'Employer not approved' });
      return;
    }

    const result = await getVerifiedRecord(employer.id, req.body.apaarId);
    if ('error' in result) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.json(result);
  }),
);

// Generate verification certificate
employerOnly.post(
  '/certificate',
  validate(recordAccessSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const employer = await prisma.employer.findFirst({
      where: { user_id: req.user!.sub, status: 'APPROVED' },
      select: { id: true },
    });

    if (!employer) {
      res.status(403).json({ error: 'Employer not approved' });
      return;
    }

    const result = await generateVerificationCertificate(employer.id, req.body.apaarId);
    if ('error' in result) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.json(result);
  }),
);

employerRouter.use('/employer', employerOnly);

// ── AICTE admin routes for employer management ──────────────

const aicteOnly = Router();
aicteOnly.use(authenticate, requireRole('AICTE_ADMIN', 'AICTE_REVIEWER'));

aicteOnly.get(
  '/employers/pending',
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const result = await getPendingEmployers(page, limit);
    res.json(result);
  }),
);

const approveRejectSchema = z.object({
  employerId: z.string().uuid(),
});

aicteOnly.post(
  '/employers/approve',
  validate(approveRejectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await approveEmployer(req.body.employerId, req.user!.sub);
    if (!result.approved) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Employer approved' });
  }),
);

const rejectSchema = z.object({
  employerId: z.string().uuid(),
  reason: z.string().min(1).max(1000),
});

aicteOnly.post(
  '/employers/reject',
  validate(rejectSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await rejectEmployer(req.body.employerId, req.user!.sub, req.body.reason);
    if (!result.rejected) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Employer rejected' });
  }),
);

employerRouter.use('/aicte', aicteOnly);
