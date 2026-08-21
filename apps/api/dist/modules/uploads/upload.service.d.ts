import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../../config.js';
import { AuditService } from '../audit/audit.service.js';
import type { MalwareScanner } from './malware-scanner.js';
import type { ObjectStorage } from './object-storage.js';
export interface InitiateUploadInput {
    fileName: string;
    mimeType: string;
    fileSize: number;
    checksumSha256Base64?: string;
}
export declare class UploadService {
    private readonly database;
    private readonly storage;
    private readonly scanner;
    private readonly audit;
    private readonly config;
    constructor(database: PrismaClient, storage: ObjectStorage, scanner: MalwareScanner, audit: AuditService, config: AppConfig);
    initiate(userId: string, input: InitiateUploadInput): Promise<{
        uploadId: string;
        upload: import("./object-storage.js").SignedUpload;
    }>;
    finalize(userId: string, uploadId: string, clientHash?: string): Promise<{
        uploadId: string;
        contentHash: string;
        status: "CLEAN";
        duplicate: {
            type: "SAME_USER";
            contentId: string;
            title: string;
            message: string;
            proofId?: undefined;
        } | {
            type: "SAME_ORGANIZATION";
            contentId: string;
            title: string;
            message: string;
            proofId?: undefined;
        } | {
            type: "PUBLIC";
            proofId: string;
            title: string;
            message: string;
            contentId?: undefined;
        } | {
            type: "NONE";
            message: string;
            contentId?: undefined;
            title?: undefined;
            proofId?: undefined;
        };
        hashAlgorithm?: undefined;
        detectedMime?: undefined;
    } | {
        uploadId: string;
        contentHash: string;
        hashAlgorithm: string;
        status: import("@prisma/client").$Enums.UploadStatus;
        detectedMime: string | null;
        duplicate: {
            type: "SAME_USER";
            contentId: string;
            title: string;
            message: string;
            proofId?: undefined;
        } | {
            type: "SAME_ORGANIZATION";
            contentId: string;
            title: string;
            message: string;
            proofId?: undefined;
        } | {
            type: "PUBLIC";
            proofId: string;
            title: string;
            message: string;
            contentId?: undefined;
        } | {
            type: "NONE";
            message: string;
            contentId?: undefined;
            title?: undefined;
            proofId?: undefined;
        };
    }>;
    cancel(userId: string, uploadId: string): Promise<void>;
    private hashObject;
    private classifyDuplicate;
}
