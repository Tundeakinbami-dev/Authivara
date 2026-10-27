import { type PrismaClient } from '@prisma/client';
import type { AppConfig } from '../../config.js';
import type { ProvenanceProvider } from '../blockchain/blockchain-provider.js';
import { AuditService } from '../audit/audit.service.js';
export interface RegisterContentInput {
    uploadId: string;
    organizationId?: string;
    title: string;
    description?: string;
    category: string;
    tags?: string[];
    visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
}
export interface RegisterVersionInput {
    uploadId: string;
    label?: string;
    description?: string;
    tags?: string[];
}
export declare class ProvenanceService {
    private readonly database;
    private readonly blockchain;
    private readonly audit;
    private readonly config;
    constructor(database: PrismaClient, blockchain: ProvenanceProvider, audit: AuditService, config: AppConfig);
    register(userId: string, input: RegisterContentInput): Promise<{
        content: {
            id: string;
            title: string;
            contentHash: string;
        };
        proof: {
            proofId: string;
            status: import("@prisma/client").$Enums.ProofStatus;
            transactionHash: string | null;
        } | null;
        certificate: {
            certificateNumber: string;
            publicVerificationUrl: string;
        } | null;
    } | {
        content: {
            id: string;
            title: string;
            category: string;
            fileName: string;
            mimeType: string;
            fileSize: number;
            contentHash: string;
            hashAlgorithm: string;
            visibility: string;
            status: string;
            createdAt: Date;
        };
        proof: {
            proofId: string;
            hash: string;
            metadataHash: string | null;
            blockchainNetwork: string;
            transactionHash: string | null;
            blockNumber: string | null;
            timestamp: Date;
            submittedAt: Date | null;
            anchoredAt: Date | null;
            status: import("@prisma/client").$Enums.ProofStatus;
        };
        certificate: {
            publicVerificationUrl: string;
            shareToken: string;
            id: string;
            certificateNumber: string;
            generatedAt: Date;
            expiresAt: Date | null;
            status: string;
        };
        duplicateNotice: {
            type: string;
            proofId: string;
            message: string;
        } | null;
    }>;
    status(userId: string, proofId: string): Promise<{
        proofId: string;
        hash: string;
        metadataHash: string | null;
        blockchainNetwork: string;
        transactionHash: string | null;
        blockNumber: string | null;
        timestamp: Date;
        submittedAt: Date | null;
        anchoredAt: Date | null;
        status: import("@prisma/client").$Enums.ProofStatus;
    }>;
    registerVersion(userId: string, contentId: string, input: RegisterVersionInput): Promise<{
        versionNumber: number;
        proof: {
            proofId: string;
            hash: string;
            metadataHash: string | null;
            blockchainNetwork: string;
            transactionHash: string | null;
            blockNumber: string | null;
            timestamp: Date;
            submittedAt: Date | null;
            anchoredAt: Date | null;
            status: import("@prisma/client").$Enums.ProofStatus;
        };
        certificate: {
            publicVerificationUrl: string;
            shareToken: string;
            id: string;
            certificateNumber: string;
            generatedAt: Date;
            expiresAt: Date | null;
            status: string;
        };
    }>;
    refreshStatus(userId: string, proofId: string): Promise<{
        proofId: string;
        hash: string;
        metadataHash: string | null;
        blockchainNetwork: string;
        transactionHash: string | null;
        blockNumber: string | null;
        timestamp: Date;
        submittedAt: Date | null;
        anchoredAt: Date | null;
        status: import("@prisma/client").$Enums.ProofStatus;
    }>;
    private ownedProof;
    private mapStatus;
    private toRegistration;
    private contentDto;
    private proofDto;
    private certificateDto;
}
