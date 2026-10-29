import { prisma } from '../../lib/prisma.js';

const REQUIRED_ADMISSION_FIELDS = [
  'apaarId',
  'studentName',
  'dateOfBirth',
  'gender',
  'programmeCode',
  'academicYear',
] as const;

type ColumnMapping = Record<string, string>;

interface MappingResult {
  valid: true;
  mapping: ColumnMapping;
}

interface MappingError {
  valid: false;
  unmappedRequired: string[];
}

export function validateColumnMapping(
  csvHeaders: string[],
  mapping: ColumnMapping,
): MappingResult | MappingError {
  const mappedTargets = new Set(Object.values(mapping));

  const unmappedRequired = REQUIRED_ADMISSION_FIELDS.filter(
    (field: string) => !mappedTargets.has(field),
  );

  if (unmappedRequired.length > 0) {
    return { valid: false, unmappedRequired: [...unmappedRequired] };
  }

  const invalidSources = Object.keys(mapping).filter(
    (csvCol) => !csvHeaders.includes(csvCol),
  );

  if (invalidSources.length > 0) {
    return {
      valid: false,
      unmappedRequired: invalidSources.map((s) => `CSV column "${s}" not found in headers`),
    };
  }

  return { valid: true, mapping };
}

export async function saveColumnMapping(
  uploadId: string,
  institutionId: string,
  mapping: ColumnMapping,
): Promise<{ success: true } | { error: string }> {
  const upload = await prisma.upload.findFirst({
    where: { id: uploadId, institution_id: institutionId },
    select: { id: true, status: true },
  });

  if (!upload) {
    return { error: 'Upload not found' };
  }

  if (upload.status !== 'PENDING') {
    return { error: `Upload is in ${upload.status} state, expected PENDING` };
  }

  await prisma.upload.update({
    where: { id: uploadId },
    data: {
      column_mapping: mapping as any,
      status: 'MAPPED',
    },
  });

  return { success: true };
}
