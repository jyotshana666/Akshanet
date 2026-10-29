import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { handleCsvUpload, parseCsvRows } from '../services/upload/upload.service.js';
import { validateColumnMapping, saveColumnMapping } from '../services/upload/mapping.service.js';
import { transformRows } from '../services/upload/transform.service.js';
import { ingestRecords } from '../services/upload/ingest.service.js';
import {
  getDashboardStats,
  getSubmissions,
  getSubmissionRecords,
  bulkNotifyStudents,
} from '../services/institution/dashboard.service.js';
import { prisma } from '../lib/prisma.js';
import { s3 } from '../lib/s3.js';

export const institutionRouter: RouterType = Router();

const ROLES = ['INSTITUTION_ADMIN', 'INSTITUTION_STAFF'];

institutionRouter.use(authenticate, requireRole(...ROLES));

// ── Upload CSV ───────────────────────────────────────────────

institutionRouter.post(
  '/upload',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.institutionId) {
      res.status(403).json({ error: 'No institution association' });
      return;
    }

    // Express 5 does not include multer by default — read raw body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const buffer = Buffer.concat(chunks);

    const contentType = req.get('content-type') ?? '';
    const filename = req.get('x-filename') ?? 'upload.csv';

    const result = await handleCsvUpload(
      {
        buffer,
        mimetype: contentType.includes('csv') ? 'text/csv' : contentType,
        originalname: filename,
        size: buffer.length,
      },
      req.user.institutionId,
      req.user.sub,
      req.ip,
    );

    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(201).json(result);
  }),
);

// ── Map Columns ──────────────────────────────────────────────

const mapColumnsSchema = z.object({
  mapping: z.record(z.string(), z.string()),
});

institutionRouter.post(
  '/upload/:id/map-columns',
  validate(mapColumnsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.institutionId) {
      res.status(403).json({ error: 'No institution association' });
      return;
    }

    const uploadId = req.params.id as string;
    const upload = await prisma.upload.findFirst({
      where: { id: uploadId, institution_id: req.user.institutionId },
      select: { s3_key: true, status: true },
    });

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    // Re-fetch CSV to get headers
    const url = s3.getSignedUrl(upload.s3_key);
    const csvResponse = await fetch(url);
    const csvContent = await csvResponse.text();
    const { headers } = parseCsvRows(csvContent);

    const validation = validateColumnMapping(headers, req.body.mapping);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid column mapping',
        unmappedRequired: validation.unmappedRequired,
      });
      return;
    }

    const saveResult = await saveColumnMapping(
      uploadId,
      req.user.institutionId,
      req.body.mapping,
    );

    if ('error' in saveResult) {
      res.status(400).json({ error: saveResult.error });
      return;
    }

    res.json({ message: 'Column mapping saved', mapping: req.body.mapping });
  }),
);

// ── Confirm (Transform + Ingest) ─────────────────────────────

institutionRouter.post(
  '/upload/:id/confirm',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.institutionId) {
      res.status(403).json({ error: 'No institution association' });
      return;
    }

    const uploadId = req.params.id as string;
    const upload = await prisma.upload.findFirst({
      where: { id: uploadId, institution_id: req.user.institutionId },
      select: { s3_key: true, column_mapping: true, status: true },
    });

    if (!upload) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    if (upload.status !== 'MAPPED') {
      res.status(400).json({ error: `Upload is in ${upload.status} state, expected MAPPED` });
      return;
    }

    if (!upload.column_mapping) {
      res.status(400).json({ error: 'No column mapping found' });
      return;
    }

    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'PROCESSING' },
    });

    const url = s3.getSignedUrl(upload.s3_key);
    const csvResponse = await fetch(url);
    const csvContent = await csvResponse.text();
    const { headers, rows } = parseCsvRows(csvContent);

    const mapping = upload.column_mapping as Record<string, string>;
    const transformed = transformRows(headers, rows, mapping);

    const result = await ingestRecords(
      uploadId,
      req.user.institutionId,
      req.user.sub,
      transformed.valid,
      req.ip,
    );

    res.json({
      created: result.created,
      skipped: result.skipped,
      failed: result.failed + transformed.invalid.length,
      validationErrors: transformed.invalid,
      ingestErrors: result.errors,
    });
  }),
);

// ── Dashboard Stats ──────────────────────────────────────────

institutionRouter.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.institutionId) {
      res.status(403).json({ error: 'No institution association' });
      return;
    }
    const stats = await getDashboardStats(req.user.institutionId);
    res.json(stats);
  }),
);

// ── Submissions List ─────────────────────────────────────────

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

institutionRouter.get(
  '/submissions',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.institutionId) {
      res.status(403).json({ error: 'No institution association' });
      return;
    }
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await getSubmissions(req.user.institutionId, page, limit);
    res.json(result);
  }),
);

// ── Submission Records ───────────────────────────────────────

institutionRouter.get(
  '/submissions/:id/records',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.institutionId) {
      res.status(403).json({ error: 'No institution association' });
      return;
    }
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await getSubmissionRecords(
      req.params.id as string,
      req.user.institutionId,
      page,
      limit,
    );
    if ('error' in result) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json(result);
  }),
);

// ── Bulk Notify ──────────────────────────────────────────────

institutionRouter.post(
  '/submissions/:id/notify',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.institutionId) {
      res.status(403).json({ error: 'No institution association' });
      return;
    }
    const result = await bulkNotifyStudents(
      req.params.id as string,
      req.user.institutionId,
      req.user.sub,
    );
    if ('error' in result) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json(result);
  }),
);
