import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { setAuthCookies, clearAuthCookies } from '../lib/jwt.js';
import {
  sendOtpEmailSchema,
  sendOtpMobileSchema,
  verifyOtpEmailSchema,
  verifyOtpMobileSchema,
  studentRegisterSchema,
} from '../services/auth/schemas.js';
import { sendInstitutionOtp, verifyInstitutionOtp } from '../services/auth/institution.service.js';
import { sendStudentOtp, verifyStudentOtp, registerStudent } from '../services/auth/student.service.js';
import { sendEmployerOtp, verifyEmployerOtp } from '../services/auth/employer.service.js';
import { sendAicteOtp, verifyAicteOtp } from '../services/auth/aicte.service.js';
import { refreshTokens, logout } from '../services/auth/session.service.js';

export const authRouter: RouterType = Router();

// ── Institution ──────────────────────────────────────────────

authRouter.post(
  '/institution/send-otp',
  validate(sendOtpEmailSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await sendInstitutionOtp(req.body.email);
    if (!result.success) {
      res.status(429).json({ error: result.error });
      return;
    }
    res.json({ message: 'OTP sent if account exists' });
  }),
);

authRouter.post(
  '/institution/verify-otp',
  validate(verifyOtpEmailSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await verifyInstitutionOtp(
      req.body.email,
      req.body.code,
      req.ip,
      req.get('user-agent'),
    );
    if ('error' in result) {
      res.status(401).json({ error: result.error });
      return;
    }
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ message: 'Authenticated' });
  }),
);

// ── Student ──────────────────────────────────────────────────

authRouter.post(
  '/student/send-otp',
  validate(sendOtpMobileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await sendStudentOtp(req.body.mobile);
    if (!result.success) {
      res.status(429).json({ error: result.error });
      return;
    }
    res.json({ message: 'OTP sent if account exists' });
  }),
);

authRouter.post(
  '/student/verify-otp',
  validate(verifyOtpMobileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await verifyStudentOtp(
      req.body.mobile,
      req.body.code,
      req.ip,
      req.get('user-agent'),
    );
    if ('error' in result) {
      res.status(401).json({ error: result.error });
      return;
    }
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ message: 'Authenticated' });
  }),
);

authRouter.post(
  '/student/register',
  validate(studentRegisterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await registerStudent(req.body, req.ip);
    if ('error' in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(201).json({ message: 'Registration successful' });
  }),
);

// ── Employer ─────────────────────────────────────────────────

authRouter.post(
  '/employer/send-otp',
  validate(sendOtpEmailSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await sendEmployerOtp(req.body.email);
    if (!result.success) {
      res.status(429).json({ error: result.error });
      return;
    }
    res.json({ message: 'OTP sent if account exists' });
  }),
);

authRouter.post(
  '/employer/verify-otp',
  validate(verifyOtpEmailSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await verifyEmployerOtp(
      req.body.email,
      req.body.code,
      req.ip,
      req.get('user-agent'),
    );
    if ('error' in result) {
      const status = result.error.includes('pending') ? 403 : 401;
      res.status(status).json({ error: result.error });
      return;
    }
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ message: 'Authenticated' });
  }),
);

// ── AICTE ────────────────────────────────────────────────────

authRouter.post(
  '/aicte/send-otp',
  validate(sendOtpEmailSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await sendAicteOtp(req.body.email);
    if (!result.success) {
      res.status(429).json({ error: result.error });
      return;
    }
    res.json({ message: 'OTP sent if account exists' });
  }),
);

authRouter.post(
  '/aicte/verify-otp',
  validate(verifyOtpEmailSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await verifyAicteOtp(
      req.body.email,
      req.body.code,
      req.ip,
      req.get('user-agent'),
    );
    if ('error' in result) {
      res.status(401).json({ error: result.error });
      return;
    }
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ message: 'Authenticated', fido2Required: result.fido2Required });
  }),
);

// ── Session ──────────────────────────────────────────────────

authRouter.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.refresh_token;
    if (!token) {
      res.status(401).json({ error: 'No refresh token' });
      return;
    }
    const result = await refreshTokens(token);
    if ('error' in result) {
      clearAuthCookies(res);
      res.status(401).json({ error: result.error });
      return;
    }
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ message: 'Tokens refreshed' });
  }),
);

authRouter.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await logout(req.user!.sub, req.user!.sessionId, req.ip, req.get('user-agent'));
    clearAuthCookies(res);
    res.json({ message: 'Logged out' });
  }),
);
