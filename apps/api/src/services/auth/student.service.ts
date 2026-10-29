import { PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { sha256, generateSessionId } from '../../lib/hash.js';
import { signAccessToken, signRefreshToken, type TokenPayload } from '../../lib/jwt.js';
import { redis } from '../../lib/redis.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { generateOtp, verifyOtp } from './otp.service.js';

export async function sendStudentOtp(mobile: string): Promise<{ success: boolean; error?: string }> {
  const mobileHash = sha256(mobile);
  const user = await prisma.user.findFirst({
    where: { mobile_hash: mobileHash, role: 'STUDENT', is_active: true },
    select: { id: true },
  });

  if (!user) {
    return { success: true };
  }

  const result = await generateOtp(mobile, 'student_login');
  if ('error' in result) {
    return { success: false, error: result.error };
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Student OTP for ${mobileHash.slice(0, 8)}...: ${result.code}`);
  }

  return { success: true };
}

export async function verifyStudentOtp(
  mobile: string,
  code: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ accessToken: string; refreshToken: string } | { error: string }> {
  const otpResult = await verifyOtp(mobile, 'student_login', code);
  if (!otpResult.valid) {
    return { error: otpResult.error };
  }

  const mobileHash = sha256(mobile);
  const user = await prisma.user.findFirst({
    where: { mobile_hash: mobileHash, role: 'STUDENT', is_active: true },
    select: { id: true, role: true },
  });

  if (!user) {
    return { error: 'User not found' };
  }

  const sessionId = generateSessionId();
  const payload: TokenPayload = { sub: user.id, role: user.role, sessionId };

  await redis.set(`session:${sessionId}`, user.id, 'EX', 7 * 24 * 60 * 60);

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await writeAuditEvent({
    actorId: user.id,
    action: 'LOGIN',
    targetTable: 'users',
    targetId: user.id,
    ipAddress,
    userAgent,
  });

  return { accessToken, refreshToken };
}

interface StudentRegistration {
  apaarId: string;
  name: string;
  dateOfBirth: string;
  mobile: string;
  collegeEmail: string;
}

export async function registerStudent(
  input: StudentRegistration,
  ipAddress?: string,
): Promise<{ userId: string } | { error: string }> {
  const mobileHash = sha256(input.mobile);
  const emailHash = sha256(input.collegeEmail);

  const existingStudent = await prisma.student.findUnique({
    where: { apaar_id: input.apaarId },
    select: { id: true },
  });

  if (existingStudent) {
    return { error: 'Student with this APAAR ID already exists' };
  }

  const existingUser = await prisma.user.findFirst({
    where: { mobile_hash: mobileHash, role: 'STUDENT' },
    select: { id: true },
  });

  if (existingUser) {
    return { error: 'Mobile number already registered' };
  }

  const result = await prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
    const student = await tx.student.create({
      data: {
        apaar_id: input.apaarId,
        name: input.name,
        date_of_birth: new Date(input.dateOfBirth),
        gender: 'undisclosed',
        mobile_hash: mobileHash,
        email_hash: emailHash,
      },
      select: { id: true },
    });

    const user = await tx.user.create({
      data: {
        email_hash: emailHash,
        mobile_hash: mobileHash,
        password_hash: 'otp_only',
        role: 'STUDENT',
      },
      select: { id: true },
    });

    await tx.consent.create({
      data: {
        student_id: student.id,
        type: 'VERIFICATION',
        status: 'GRANTED',
        ip_address: ipAddress ?? null,
      },
    });

    return { userId: user.id, studentId: student.id };
  });

  await writeAuditEvent({
    actorId: result.userId,
    action: 'CREATE',
    targetTable: 'students',
    targetId: result.studentId,
    ipAddress,
  });

  return { userId: result.userId };
}
