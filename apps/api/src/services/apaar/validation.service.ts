import { prisma } from '../../lib/prisma.js';
import { validateApaar } from '../../lib/apaar.js';
import { transition } from '../../lib/stateMachine.js';
import { apaarValidationQueue, notificationQueue } from '../../lib/queues.js';

const SYSTEM_ACTOR = 'system:apaar-validator';
const SYSTEM_ROLE = 'SYSTEM';
const RETRY_DELAY_MS = 30 * 60 * 1000;
const MAX_RETRIES = 48;

export async function processBatch(uploadId: string): Promise<{
  processed: number;
  verified: number;
  mismatched: number;
  notFound: number;
  retried: number;
  errors: number;
}> {
  const admissions = await prisma.admission.findMany({
    where: { upload_id: uploadId, verification_status: 'draft' },
    select: {
      id: true,
      apaar_id: true,
      institution_id: true,
      student: { select: { name: true, date_of_birth: true, gender: true } },
    },
  });

  let verified = 0;
  let mismatched = 0;
  let notFound = 0;
  let retried = 0;
  let errors = 0;

  for (const admission of admissions) {
    try {
      await transition(
        prisma, admission.id,
        'submitted',
        SYSTEM_ACTOR, SYSTEM_ROLE,
      );

      const result = await validateRecord(admission);

      if (result === 'verified') verified++;
      else if (result === 'mismatch') mismatched++;
      else if (result === 'not_found') notFound++;
      else if (result === 'retry') retried++;
    } catch {
      errors++;
    }
  }

  return {
    processed: admissions.length,
    verified,
    mismatched,
    notFound,
    retried,
    errors,
  };
}

interface AdmissionForValidation {
  id: string;
  apaar_id: string;
  institution_id: string;
  student: {
    name: string;
    date_of_birth: Date;
    gender: string;
  };
}

export async function validateRecord(
  admission: AdmissionForValidation,
  retryCount = 0,
): Promise<'verified' | 'mismatch' | 'not_found' | 'retry'> {
  try {
    const result = await validateApaar(admission.apaar_id, {
      name: admission.student.name,
      dob: admission.student.date_of_birth.toISOString().split('T')[0],
      gender: admission.student.gender,
    });

    if (!result.active) {
      await transition(
        prisma, admission.id,
        'apaar_not_found',
        SYSTEM_ACTOR, SYSTEM_ROLE,
      );

      await notificationQueue.add(admission.id, {
        type: 'apaar_not_found',
        admissionId: admission.id,
        apaarId: admission.apaar_id,
        institutionId: admission.institution_id,
      });

      return 'not_found';
    }

    if (!result.match) {
      await transition(
        prisma, admission.id,
        'data_mismatch',
        SYSTEM_ACTOR, SYSTEM_ROLE,
      );
      return 'mismatch';
    }

    await prisma.admission.update({
      where: { id: admission.id },
      data: { apaar_validated_at: new Date() },
    });

    await transition(
      prisma, admission.id,
      'apaar_verified',
      SYSTEM_ACTOR, SYSTEM_ROLE,
    );

    return 'verified';
  } catch {
    if (retryCount >= MAX_RETRIES) {
      await notificationQueue.add(admission.id, {
        type: 'apaar_validation_failed',
        admissionId: admission.id,
        apaarId: admission.apaar_id,
        institutionId: admission.institution_id,
        message: 'APAAR validation exhausted all retries after 24h',
      });
      return 'not_found';
    }

    await transition(
      prisma, admission.id,
      'apaar_retry_pending',
      SYSTEM_ACTOR, SYSTEM_ROLE,
    );

    await apaarValidationQueue.addDelayed(admission.id, {
      admissionId: admission.id,
      apaarId: admission.apaar_id,
      retryCount: retryCount + 1,
    }, RETRY_DELAY_MS);

    return 'retry';
  }
}
