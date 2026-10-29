import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { getProfile } from '../services/student/profile.service.js';
import { verifyRecord, flagRecord, getFlags } from '../services/student/verification.service.js';
import { getConsents, revokeConsent } from '../services/student/consent.service.js';
import { getAccessLog } from '../services/student/accessLog.service.js';
import { generatePdf, verifyCredential } from '../services/student/credential.service.js';
import {
  getPendingRequests,
  approveConsentByToken,
  denyConsentByToken,
} from '../services/employer/consentRequest.service.js';
import { blockEmployer } from '../services/employer/verification.service.js';
import { prisma } from '../lib/prisma.js';

export const studentRouter: RouterType = Router();

// ── Public: verify credential hash ──────────────────────────

studentRouter.get(
  '/verify/:hash',
  asyncHandler(async (req: Request, res: Response) => {
    const hash = req.params.hash as string;
    const result = await verifyCredential(hash);
    res.json(result);
  }),
);

// ── All routes below require student auth ───────────────────

const studentOnly = Router();
studentOnly.use(authenticate, requireRole('STUDENT'));

// ── Profile ─────────────────────────────────────────────────

studentOnly.get(
  '/profile',
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { apaar_id: true },
    });

    if (!student) {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.sub },
        select: { id: true },
      });
      if (!user) {
        res.status(404).json({ error: 'Student not found' });
        return;
      }
      const studentByUser = await prisma.student.findFirst({
        where: { mobile_hash: user.id },
        select: { apaar_id: true },
      });
      if (!studentByUser) {
        res.status(404).json({ error: 'No student record linked' });
        return;
      }
      const profile = await getProfile(studentByUser.apaar_id);
      res.json(profile);
      return;
    }

    const profile = await getProfile(student.apaar_id);
    if ('error' in profile) {
      res.status(404).json({ error: profile.error });
      return;
    }
    res.json(profile);
  }),
);

// ── Verify admission ────────────────────────────────────────

const verifySchema = z.object({
  admissionId: z.string().uuid(),
});

studentOnly.post(
  '/verify',
  validate(verifySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { id: true, apaar_id: true },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const result = await verifyRecord(req.body.admissionId, student.id, student.apaar_id);
    if (!result.verified) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Record verified', admissionId: req.body.admissionId });
  }),
);

// ── Flag admission field ────────────────────────────────────

const flagSchema = z.object({
  admissionId: z.string().uuid(),
  fieldName: z.string().min(1).max(100),
  reason: z.string().min(1).max(1000),
});

studentOnly.post(
  '/flag',
  validate(flagSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { id: true, apaar_id: true },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const result = await flagRecord(
      req.body.admissionId, student.id, student.apaar_id,
      req.body.fieldName, req.body.reason,
    );
    if (!result.flagged) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ message: 'Flag created', flagId: result.flagId });
  }),
);

// ── List own flags ──────────────────────────────────────────

studentOnly.get(
  '/flags',
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { id: true },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const flags = await getFlags(student.id);
    res.json({ flags });
  }),
);

// ── Consents ────────────────────────────────────────────────

studentOnly.get(
  '/consents',
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { id: true },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const consents = await getConsents(student.id);
    res.json({ consents });
  }),
);

studentOnly.post(
  '/consents/revoke/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { id: true },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const consentId = req.params.id as string;
    const result = await revokeConsent(student.id, consentId);
    if (!result.revoked) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Consent revoked' });
  }),
);

// ── Access log ──────────────────────────────────────────────

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

studentOnly.get(
  '/access-log',
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { id: true },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const { page, limit } = paginationSchema.parse(req.query);
    const result = await getAccessLog(student.id, page, limit);
    res.json(result);
  }),
);

// ── Credential PDF ──────────────────────────────────────────

studentOnly.get(
  '/credential/pdf',
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { id: true, apaar_id: true },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const admission = await prisma.admission.findFirst({
      where: { apaar_id: student.apaar_id },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });

    if (!admission) {
      res.status(404).json({ error: 'No admission record found' });
      return;
    }

    const result = await generatePdf(admission.id, student.id, student.apaar_id);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  }),
);

// ── Pending consent requests from employers ────────────────

studentOnly.get(
  '/consent-requests',
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { id: true },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const requests = await getPendingRequests(student.id);
    res.json({ requests });
  }),
);

// ── Approve consent request via token ──────────────────────

const tokenSchema = z.object({
  token: z.string().min(1),
});

studentOnly.post(
  '/consent-requests/approve',
  validate(tokenSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { id: true },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const result = await approveConsentByToken(req.body.token, student.id);
    if (!result.approved) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Consent granted to employer' });
  }),
);

// ── Deny consent request via token ─────────────────────────

studentOnly.post(
  '/consent-requests/deny',
  validate(tokenSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { id: true },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const result = await denyConsentByToken(req.body.token, student.id);
    if (!result.denied) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Consent request denied' });
  }),
);

// ── Block employer ─────────────────────────────────────────

const blockSchema = z.object({
  employerId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

studentOnly.post(
  '/block-employer',
  validate(blockSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const student = await prisma.student.findFirst({
      where: { id: req.user!.sub },
      select: { id: true },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const result = await blockEmployer(student.id, req.body.employerId, req.body.reason);
    if (!result.blocked) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ message: 'Employer blocked' });
  }),
);

studentRouter.use('/student', studentOnly);
