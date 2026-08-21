import type { Prisma, PrismaClient } from '@prisma/client';
type DatabaseClient = PrismaClient | Prisma.TransactionClient;
export interface AuditEventInput {
    userId?: string;
    organizationId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: Prisma.InputJsonValue;
}
export declare class AuditService {
    private readonly database;
    constructor(database: PrismaClient);
    append(input: AuditEventInput, client?: DatabaseClient): Promise<{
        id: string;
        userId: string | null;
        organizationId: string | null;
        action: string;
        resource: string;
        resourceId: string | null;
        timestamp: Date;
        metadata: Prisma.JsonValue | null;
        previousHash: string | null;
        eventHash: string;
        signature: string | null;
    }>;
}
export {};
