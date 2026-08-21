import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../../config.js';
import type { AuditService } from '../audit/audit.service.js';
export declare class CertificateService {
    private readonly database;
    private readonly config;
    private readonly audit;
    constructor(database: PrismaClient, config: AppConfig, audit: AuditService);
    forOwner(userId: string, certificateNumber: string): Promise<{
        bytes: Uint8Array<ArrayBufferLike>;
        filename: string;
    }>;
    forPublicProof(proofId: string): Promise<{
        bytes: Uint8Array<ArrayBufferLike>;
        filename: string;
    }>;
    private findByNumber;
    private issueDurablePrivateLink;
    private render;
}
