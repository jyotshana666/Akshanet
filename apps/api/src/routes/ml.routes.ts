import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { prisma } from '../lib/prisma.js';
import { scoreUpload } from '../services/ml/scoring.service.js';

export const mlRouter: RouterType = Router();

mlRouter.use(authenticate);

// ── Risk scores for an upload ───────────────────────────────

mlRouter.get(
  '/scores/:uploadId',
  requireRole('INSTITUTION_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.institutionId) {
      res.status(403).json({ error: 'No institution association' });
      return;
    }

    const uploadId = req.params.uploadId as string;
    const upload = await prisma.upload.findFirst({
      where: { id: uploadId, institution_id: req.user.institutionId },
      select: { id: true },
    });

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    const records = await prisma.admission.findMany({
      where: { upload_id: uploadId, institution_id: req.user.institutionId },
      select: {
        id: true,
        apaar_id: true,
        apaar_risk_score: true,
        verification_status: true,
        student: { select: { name: true } },
        programme: { select: { code: true } },
      },
    });

    res.json({
      uploadId,
      records: records.map((r: typeof records[number]) => ({
        admissionId: r.id,
        apaarId: r.apaar_id,
        studentName: r.student.name,
        programmeCode: r.programme.code,
        riskScore: r.apaar_risk_score,
        status: r.verification_status,
      })),
    });
  }),
);

// ── Flagged records (AICTE only) ────────────────────────────

const flaggedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

mlRouter.get(
  '/flagged',
  requireRole('AICTE_ADMIN', 'AICTE_REVIEWER'),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = flaggedQuerySchema.parse(req.query);

    const where = {
      verification_status: { in: ['fraud_escalation', 'anomaly_watch'] as any },
    };

    const [records, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        orderBy: { apaar_risk_score: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          apaar_id: true,
          apaar_risk_score: true,
          verification_status: true,
          institution_id: true,
          academic_year: true,
          student: { select: { name: true } },
          programme: { select: { code: true } },
          institution: { select: { name: true } },
        },
      }),
      prisma.admission.count({ where }),
    ]);

    res.json({
      records: records.map((r: typeof records[number]) => ({
        admissionId: r.id,
        apaarId: r.apaar_id,
        studentName: r.student.name,
        programmeCode: r.programme.code,
        institutionName: r.institution.name,
        institutionId: r.institution_id,
        riskScore: r.apaar_risk_score,
        status: r.verification_status,
        academicYear: r.academic_year,
      })),
      total,
      page,
      limit,
    });
  }),
);

// ── Manual rescore (AICTE national only) ────────────────────

mlRouter.post(
  '/rescore/:uploadId',
  requireRole('AICTE_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const uploadId = req.params.uploadId as string;
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      select: { id: true, status: true },
    });

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    const result = await scoreUpload(uploadId);
    res.json(result);
  }),
);
