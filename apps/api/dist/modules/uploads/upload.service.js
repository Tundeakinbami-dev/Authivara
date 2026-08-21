import { createHash, randomUUID } from 'node:crypto';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js';
import { validateFileDeclaration, validateFileSignature } from './file-policy.js';
import { classifyDuplicate } from './duplicate-policy.js';
export class UploadService {
    database;
    storage;
    scanner;
    audit;
    config;
    constructor(database, storage, scanner, audit, config) {
        this.database = database;
        this.storage = storage;
        this.scanner = scanner;
        this.audit = audit;
        this.config = config;
    }
    async initiate(userId, input) {
        validateFileDeclaration(input, this.config.MAX_UPLOAD_BYTES);
        const storageKey = `private/${userId}/${new Date().getUTCFullYear()}/${randomUUID()}`;
        const signed = await this.storage.createSignedUpload({
            key: storageKey,
            mimeType: input.mimeType,
            fileSize: input.fileSize,
            checksumSha256: input.checksumSha256Base64,
            expiresInSeconds: 15 * 60,
        });
        const upload = await this.database.upload.create({
            data: {
                ownerId: userId,
                storageKey,
                fileName: input.fileName,
                declaredMime: input.mimeType.toLowerCase(),
                fileSize: BigInt(input.fileSize),
                status: 'UPLOADING',
                expiresAt: signed.expiresAt,
                encryption: this.config.STORAGE_KMS_KEY_ID ? 'aws:kms' : 'AES256',
            },
        });
        await this.audit.append({ userId, action: 'UPLOAD_INITIATED', resource: 'Upload', resourceId: upload.id, metadata: { fileSize: input.fileSize, mimeType: input.mimeType } });
        return { uploadId: upload.id, upload: signed };
    }
    async finalize(userId, uploadId, clientHash) {
        const upload = await this.database.upload.findUnique({ where: { id: uploadId } });
        if (!upload)
            throw new NotFoundError('Upload');
        if (upload.ownerId !== userId)
            throw new ForbiddenError();
        if (upload.status === 'CLEAN' && upload.expectedHash) {
            return { uploadId: upload.id, contentHash: upload.expectedHash, status: upload.status, duplicate: await this.classifyDuplicate(userId, upload.expectedHash) };
        }
        if (!['UPLOADING', 'UPLOADED', 'SCANNING'].includes(upload.status))
            throw new ConflictError(`Upload cannot be finalized from status ${upload.status}`);
        const metadata = await this.storage.head(upload.storageKey);
        if (metadata.size !== Number(upload.fileSize))
            throw new ConflictError('Stored object size does not match the declared size');
        if (metadata.contentType && metadata.contentType.toLowerCase() !== upload.declaredMime) {
            throw new ConflictError('Stored object MIME type does not match the signed upload declaration');
        }
        const header = await this.storage.readHeader(upload.storageKey);
        const detected = validateFileSignature({ fileName: upload.fileName, mimeType: upload.declaredMime, fileSize: metadata.size }, header, this.config.MAX_UPLOAD_BYTES);
        await this.database.upload.update({ where: { id: upload.id }, data: { status: 'SCANNING', detectedMime: upload.declaredMime } });
        const contentHash = await this.hashObject(upload.storageKey);
        if (clientHash && !/^[a-f0-9]{64}$/i.test(clientHash))
            throw new ConflictError('Client SHA-256 digest is malformed');
        if (clientHash && clientHash.toLowerCase() !== contentHash)
            throw new ConflictError('Client and server SHA-256 digests do not match');
        const downloadUrl = await this.storage.createSignedReadUrl(upload.storageKey, 5 * 60);
        const scan = await this.scanner.scan({ storageKey: upload.storageKey, downloadUrl, sha256: contentHash });
        if (scan === 'INFECTED') {
            await this.storage.remove(upload.storageKey);
            await this.database.upload.update({ where: { id: upload.id }, data: { status: 'REJECTED', scanResult: scan } });
            throw new ConflictError('The uploaded object failed malware scanning and was removed');
        }
        const completed = await this.database.upload.update({
            where: { id: upload.id },
            data: { status: 'CLEAN', expectedHash: contentHash, scanResult: scan, completedAt: new Date(), detectedMime: detected.mimeTypes[0] },
        });
        const duplicate = await this.classifyDuplicate(userId, contentHash);
        await this.audit.append({ userId, action: 'UPLOAD_FINALIZED', resource: 'Upload', resourceId: upload.id, metadata: { contentHash, scanResult: scan, duplicateType: duplicate.type } });
        return { uploadId: completed.id, contentHash, hashAlgorithm: 'SHA-256', status: completed.status, detectedMime: completed.detectedMime, duplicate };
    }
    async cancel(userId, uploadId) {
        const upload = await this.database.upload.findUnique({ where: { id: uploadId } });
        if (!upload)
            throw new NotFoundError('Upload');
        if (upload.ownerId !== userId)
            throw new ForbiddenError();
        if (upload.contentId)
            throw new ConflictError('A registered content object cannot be cancelled');
        await this.storage.remove(upload.storageKey);
        await this.database.upload.update({ where: { id: upload.id }, data: { status: 'CANCELLED' } });
        await this.audit.append({ userId, action: 'UPLOAD_CANCELLED', resource: 'Upload', resourceId: upload.id });
    }
    async hashObject(storageKey) {
        const hash = createHash('sha256');
        for await (const chunk of await this.storage.stream(storageKey))
            hash.update(chunk);
        return hash.digest('hex');
    }
    async classifyDuplicate(userId, contentHash) {
        const memberships = await this.database.organizationMember.findMany({ where: { userId }, select: { organizationId: true } });
        const organizationIds = memberships.map((membership) => membership.organizationId);
        const matches = await this.database.content.findMany({
            where: { contentHash, status: { not: 'ARCHIVED' } },
            select: {
                id: true, ownerId: true, organizationId: true, title: true, visibility: true,
                provenance: { orderBy: { timestamp: 'desc' }, take: 1, select: { proofId: true } },
            },
        });
        return classifyDuplicate(matches, userId, organizationIds);
    }
}
