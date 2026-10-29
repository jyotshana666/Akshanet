import { createHash } from 'node:crypto';
import { prisma } from './prisma.js';

interface AuditInput {
  actorId: string;
  institutionId?: string;
  admissionId?: string;
  action: string;
  targetTable: string;
  targetId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

let lastHash = '';

function chainHash(data: string): string {
  const input = lastHash + data;
  const hash = createHash('sha256').update(input).digest('hex');
  lastHash = hash;
  return hash;
}

export async function writeAuditEvent(input: AuditInput): Promise<void> {
  const eventData = JSON.stringify({
    ...input,
    timestamp: new Date().toISOString(),
  });
  chainHash(eventData);

  await prisma.auditEvent.create({
    data: {
      actor_id: input.actorId,
      institution_id: input.institutionId ?? null,
      admission_id: input.admissionId ?? null,
      action: input.action as any,
      target_table: input.targetTable,
      target_id: input.targetId,
      old_value: input.oldValue ? JSON.parse(JSON.stringify(input.oldValue)) : undefined,
      new_value: input.newValue ? JSON.parse(JSON.stringify(input.newValue)) : undefined,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    },
  });
}
