import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../../config.js';
import type { BlockchainProvider } from '../blockchain/blockchain-provider.js';
export interface VerificationContext {
    requester?: string;
    ip?: string;
    userAgent?: string;
}
export declare class VerificationService {
    private readonly database;
    private readonly config;
    private readonly blockchain;
    constructor(database: PrismaClient, config: AppConfig, blockchain: BlockchainProvider);
    inspect(shareToken: string): Promise<{
        certificate: {
            certificateNumber: string;
            generatedAt: Date;
            status: import("@prisma/client").$Enums.CertificateStatus;
            content: {
                title: string;
                category: string;
                visibility: import("@prisma/client").$Enums.ContentVisibility;
                creator: string | undefined;
            };
            proof: {
                proofId: string;
                hashAlgorithm: string;
                contentHash: string;
                metadataHash: string | null;
                network: string;
                transactionHash: string | null;
                blockNumber: string | null;
                submittedAt: Date | null;
                anchoredAt: Date | null;
                status: import("@prisma/client").$Enums.ProofStatus;
            };
        };
    }>;
    verify(shareToken: string, submittedHash: string, context: VerificationContext): Promise<{
        result: string;
        exactMatch: boolean;
        anchorVerified: boolean;
        certificate: {
            certificateNumber: string;
            generatedAt: Date;
            status: import("@prisma/client").$Enums.CertificateStatus;
            content: {
                title: string;
                category: string;
                visibility: import("@prisma/client").$Enums.ContentVisibility;
                creator: string | undefined;
            };
            proof: {
                proofId: string;
                hashAlgorithm: string;
                contentHash: string;
                metadataHash: string | null;
                network: string;
                transactionHash: string | null;
                blockNumber: string | null;
                submittedAt: Date | null;
                anchoredAt: Date | null;
                status: import("@prisma/client").$Enums.ProofStatus;
            };
        };
        notice: string;
    }>;
    inspectPublicProof(proofId: string): Promise<{
        proof: {
            heading: string;
            status: import("@prisma/client").$Enums.ProofStatus;
            content: {
                title: string;
                type: string;
            };
            registeredAt: Date;
            proofId: string;
            hashAlgorithm: string;
            contentHash: string;
            metadataHash: string | null;
            blockchain: string;
            transactionHash: string | null;
            blockchainUrl: string | null;
            blockNumber: string | null;
            submittedAt: Date | null;
            confirmedAt: Date | null;
            certificate: {
                certificateNumber: string;
                generatedAt: Date;
                status: import("@prisma/client").$Enums.CertificateStatus;
            } | null;
            publicUrl: string;
        };
        timeline: {
            type: string;
            timestamp: Date;
            title: string;
            detail: string;
        }[];
        anchorVerified: boolean;
    }>;
    verifyPublic(submittedHashInput: string, proofId: string | undefined, context: VerificationContext): Promise<{
        result: string;
        exactMatch: boolean;
        anchorVerified: boolean;
        relatedVersion: {
            versionNumber: number;
            proofId: string | null;
            registeredAt: Date;
        } | null;
        proof: {
            heading: string;
            status: import("@prisma/client").$Enums.ProofStatus;
            content: {
                title: string;
                type: string;
            };
            registeredAt: Date;
            proofId: string;
            hashAlgorithm: string;
            contentHash: string;
            metadataHash: string | null;
            blockchain: string;
            transactionHash: string | null;
            blockchainUrl: string | null;
            blockNumber: string | null;
            submittedAt: Date | null;
            confirmedAt: Date | null;
            certificate: {
                certificateNumber: string;
                generatedAt: Date;
                status: import("@prisma/client").$Enums.CertificateStatus;
            } | null;
            publicUrl: string;
        };
        notice: "The uploaded file matches the registered cryptographic fingerprint." | "The uploaded file matches an earlier or later registered version of this work." | "The uploaded file does not match this proof or any registered version of the work." | "The file fingerprint matched, but this proof or certificate has been revoked.";
    } | {
        result: "INVALID_PROOF";
        exactMatch: boolean;
        anchorVerified: boolean;
        notice: string;
    } | {
        result: "NO_MATCH";
        exactMatch: boolean;
        anchorVerified: boolean;
        notice: string;
    }>;
    private compareWithProof;
    private findPublicProof;
    private publicProofInclude;
    private publicProof;
    private timeline;
    private findCertificate;
    private publicCertificate;
}
