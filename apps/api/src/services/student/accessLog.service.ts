import { prisma } from '../../lib/prisma.js';

export async function logAccess(
  studentId: string,
  accessorId: string,
  accessorRole: string,
  fieldsAccessed: string[],
  consentId?: string,
): Promise<void> {
  await prisma.accessLog.create({
    data: {
      student_id: studentId,
      accessor_id: accessorId,
      accessor_role: accessorRole,
      fields_accessed: fieldsAccessed,
      consent_id: consentId ?? null,
    },
  });
}

export async function getAccessLog(
  studentId: string,
  page: number,
  limit: number,
): Promise<{
  logs: Array<{
    id: string;
    accessorId: string;
    accessorRole: string;
    fieldsAccessed: string[];
    accessedAt: string;
  }>;
  total: number;
}> {
  const [logs, total] = await Promise.all([
    prisma.accessLog.findMany({
      where: { student_id: studentId },
      orderBy: { accessed_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        accessor_id: true,
        accessor_role: true,
        fields_accessed: true,
        accessed_at: true,
      },
    }),
    prisma.accessLog.count({ where: { student_id: studentId } }),
  ]);

  return {
    logs: logs.map((l: typeof logs[number]) => ({
      id: l.id,
      accessorId: l.accessor_id,
      accessorRole: l.accessor_role,
      fieldsAccessed: l.fields_accessed,
      accessedAt: l.accessed_at.toISOString(),
    })),
    total,
  };
}
