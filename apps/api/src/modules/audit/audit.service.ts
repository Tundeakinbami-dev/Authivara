import type { Prisma, PrismaClient } from '@prisma/client';
import { canonicalJson, sha256 } from '../../shared/crypto.js';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export interface AuditEventInput {
  userId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
}

export class AuditService {
  constructor(private readonly database: PrismaClient) {}

  async append(input: AuditEventInput, client: DatabaseClient = this.database) {
    const previous = await client.auditLog.findFirst({
      where: { organizationId: input.organizationId ?? null },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      select: { eventHash: true },
    });
    const timestamp = new Date();
    const eventHash = sha256(canonicalJson({ ...input, previousHash: previous?.eventHash ?? null, timestamp: timestamp.toISOString() }));
    return client.auditLog.create({
      data: { ...input, timestamp, previousHash: previous?.eventHash, eventHash },
    });
  }
}
