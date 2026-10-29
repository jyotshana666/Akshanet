import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { prisma } from '../lib/prisma.js';
import { processBatch } from '../services/apaar/validation.service.js';
import { resolveDuplicate } from '../services/apaar/duplicate.service.js';

export const apaarRouter: RouterType = Router();

apaarRouter.use(authenticate);

// ── APAAR validation status for a specific admission ────────

apaarRouter.get(
  '/status/:admissionId',
  requireRole('INSTITUTION_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.institutionId) {
      res.status(403).json({ error: 'No institution association' });
      return;
    }

    const admissionId = req.params.admissionId as string;
    const admission = await prisma.admission.findFirst({
      where: { id: admissionId, institution_id: req.user.institutionId },
      select: {
        id: true,
        apaar_id: true,
        verification_status: true,
        apaar_validated_at: true,
        apaar_risk_score: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!admission) {
      res.status(404).json({ error: 'Admission not found' });
      return;
    }

    res.json(admission);
  }),
);

// ── Retry APAAR validation ──────────────────────────────────

apaarRouter.post(
  '/retry/:admissionId',
  requireRole('INSTITUTION_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.institutionId) {
      res.status(403).json({ error: 'No institution association' });
      return;
    }

    const admissionId = req.params.admissionId as string;
    const admission = await prisma.admission.findFirst({
      where: { id: admissionId, institution_id: req.user.institutionId },
      select: {
        id: true,
        verification_status: true,
        upload_id: true,
      },
    });

    if (!admission) {
      res.status(404).json({ error: 'Admission not found' });
      return;
    }

    const retryableStates = ['data_mismatch', 'apaar_not_found', 'apaar_retry_pending'];
    if (!retryableStates.includes(admission.verification_status)) {
      res.status(400).json({
        error: `Cannot retry from ${admission.verification_status} state`,
      });
      return;
    }

    const { transition } = await import('../lib/stateMachine.js');
    await transition(prisma, admissionId, 'apaar_retry_pending' as any, req.user.sub, req.user.role);

    const { apaarValidationQueue } = await import('../lib/queues.js');
    await apaarValidationQueue.add(admissionId, {
      admissionId,
      apaarId: admission.id,
      retryCount: 0,
    });

    res.json({ message: 'Retry queued', admissionId });
  }),
);

// ── List duplicate pairs (AICTE only) ───────────────────────

const duplicatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'RESOLVED']).optional(),
});

apaarRouter.get(
  '/duplicates',
  requireRole('AICTE_ADMIN', 'AICTE_REVIEWER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, status } = duplicatesQuerySchema.parse(req.query);

    const where = status ? { status: status as any } : {};

    const [pairs, total] = await Promise.all([
      prisma.duplicatePair.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.duplicatePair.count({ where }),
    ]);

    res.json({ pairs, total, page, limit });
  }),
);

// ── Resolve a duplicate pair (AICTE only) ───────────────────

const resolveSchema = z.object({
  validAdmissionId: z.string().uuid(),
});

apaarRouter.post(
  '/duplicates/:id/resolve',
  requireRole('AICTE_ADMIN', 'AICTE_REVIEWER'),
  validate(resolveSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const pairId = req.params.id as string;
    const result = await resolveDuplicate(
      pairId,
      req.body.validAdmissionId,
      req.user!.sub,
    );

    if (!result.resolved) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ message: 'Duplicate resolved', pairId });
  }),
);

// ── Trigger batch validation (internal/admin) ───────────────

apaarRouter.post(
  '/validate-batch/:uploadId',
  requireRole('INSTITUTION_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.institutionId) {
      res.status(403).json({ error: 'No institution association' });
      return;
    }

    const uploadId = req.params.uploadId as string;
    const upload = await prisma.upload.findFirst({
      where: { id: uploadId, institution_id: req.user.institutionId },
      select: { id: true, status: true },
    });

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    if (upload.status !== 'COMPLETED') {
      res.status(400).json({ error: `Upload is ${upload.status}, expected COMPLETED` });
      return;
    }

    const result = await processBatch(uploadId);
    res.json(result);
  }),
);
