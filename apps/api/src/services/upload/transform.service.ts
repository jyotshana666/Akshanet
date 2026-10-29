import { z } from 'zod';

const admissionRowSchema = z.object({
  apaarId: z.string().regex(/^\d{12}$/),
  studentName: z.string().min(1).max(200),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['male', 'female', 'other', 'undisclosed']),
  programmeCode: z.string().min(1).max(50),
  academicYear: z.string().regex(/^\d{4}-\d{2}$/),
  seatType: z.string().min(1).max(30).optional(),
  quotaType: z.string().min(1).max(30).optional(),
  admissionMode: z.string().min(1).max(30).optional(),
  feeCategory: z.string().min(1).max(30).optional(),
  feeAmount: z.number().nonnegative().optional(),
  admissionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rollNumber: z.string().max(50).optional(),
  enrollmentNumber: z.string().max(50).optional(),
});

export type AdmissionRecord = z.infer<typeof admissionRowSchema>;

type ColumnMapping = Record<string, string>;

interface TransformSuccess {
  valid: AdmissionRecord[];
  invalid: { row: number; errors: string[] }[];
}

export function transformRows(
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping,
): TransformSuccess {
  const valid: AdmissionRecord[] = [];
  const invalid: { row: number; errors: string[] }[] = [];

  const reverseMapping: Record<string, string> = {};
  for (const [csvCol, akshanetField] of Object.entries(mapping)) {
    reverseMapping[akshanetField] = csvCol;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const record: Record<string, unknown> = {};

    for (const [akshanetField, csvCol] of Object.entries(reverseMapping)) {
      const colIndex = headers.indexOf(csvCol);
      if (colIndex >= 0 && colIndex < row.length) {
        let value: unknown = row[colIndex];
        if (akshanetField === 'feeAmount' && typeof value === 'string') {
          value = parseFloat(value) || undefined;
        }
        record[akshanetField] = value;
      }
    }

    const result = admissionRowSchema.safeParse(record);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({
        row: i + 2, // 1-indexed, +1 for header row
        errors: result.error.errors.map(
          (e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`,
        ),
      });
    }
  }

  return { valid, invalid };
}
