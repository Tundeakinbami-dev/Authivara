import { Prisma, type PrismaClient, type ProofStatus } from '@prisma/client';
import type { AppConfig } from '../../config.js';
import { canonicalJson, randomProofId, randomToken, sha256 } from '../../shared/crypto.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js';
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

export class ProvenanceService {
  constructor(
    private readonly database: PrismaClient,
    private readonly blockchain: ProvenanceProvider,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  async register(userId: string, input: RegisterContentInput) {
    const upload = await this.database.upload.findUnique({ where: { id: input.uploadId }, include: { content: { include: { provenance: true, certificates: true } } } });
    if (!upload) throw new NotFoundError('Upload');
    if (upload.ownerId !== userId) throw new ForbiddenError();
    if (upload.content) return this.toRegistration(upload.content);
    if (upload.status !== 'CLEAN' || !upload.expectedHash) throw new ConflictError('Upload must be finalized and clean before registration');

    if (input.organizationId) {
      const membership = await this.database.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: input.organizationId, userId } } });
      if (!membership || membership.role === 'VIEWER') throw new ForbiddenError('Editor access is required to register work for this organization');
    }
    const duplicate = await this.database.content.findFirst({
      where: {
        contentHash: upload.expectedHash,
        status: { not: 'ARCHIVED' },
        OR: [{ ownerId: userId }, ...(input.organizationId ? [{ organizationId: input.organizationId }] : [])],
      },
    });
    if (duplicate) throw new ConflictError(`This exact file is already registered as content ${duplicate.id}`);

    const publicDuplicate = await this.database.provenanceRecord.findFirst({
      where: { hash: upload.expectedHash, content: { visibility: 'PUBLIC', status: { not: 'ARCHIVED' }, ownerId: { not: userId } } },
      select: { proofId: true },
    });

    const proofId = randomProofId();
    const metadataHash = sha256(canonicalJson({
      schema: 'authivara-metadata/v1', title: input.title, description: input.description ?? null,
      category: input.category, tags: input.tags ?? [], visibility: input.visibility,
    }));
    const created = await this.database.$transaction(async (transaction) => {
      const content = await transaction.content.create({
        data: {
          ownerId: userId,
          organizationId: input.organizationId,
          title: input.title,
          description: input.description,
          category: input.category,
          tags: input.tags ?? [],
          fileName: upload.fileName,
          mimeType: upload.detectedMime ?? upload.declaredMime,
          fileSize: upload.fileSize,
          storageKey: upload.storageKey,
          contentHash: upload.expectedHash!,
          status: 'PROCESSING',
          visibility: input.visibility,
        },
      });
      const version = await transaction.contentVersion.create({
        data: {
          contentId: content.id, versionNumber: 1, label: 'Initial', hash: upload.expectedHash!,
          fileName: upload.fileName, mimeType: upload.detectedMime ?? upload.declaredMime, fileSize: upload.fileSize,
          description: input.description, tags: input.tags ?? [], storageKey: upload.storageKey, metadataHash, createdBy: userId,
        },
      });
      const provenance = await transaction.provenanceRecord.create({
        data: {
          contentId: content.id, contentVersionId: version.id, proofId, hash: upload.expectedHash!, metadataHash,
          blockchainNetwork: this.blockchain.network, status: 'PENDING',
        },
      });
      await transaction.upload.update({ where: { id: upload.id }, data: { contentId: content.id } });
      await this.audit.append({ userId, action: 'PROOF_CREATED', resource: 'ProvenanceRecord', resourceId: provenance.id, metadata: { proofId, contentHash: upload.expectedHash! } }, transaction);
      return { content, provenance };
    });

    try {
      const receipt = await this.blockchain.registerProof({
        proofId,
        contentHash: created.provenance.hash,
        metadataHash,
        version: 1,
        timestamp: created.provenance.timestamp.toISOString(),
      });
      const status = this.mapStatus(receipt.status);
      const shareToken = randomToken();
      const updated = await this.database.$transaction(async (transaction) => {
        const provenance = await transaction.provenanceRecord.update({
          where: { id: created.provenance.id },
          data: {
            transactionHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            submittedAt: new Date(receipt.submittedAt),
            anchoredAt: receipt.anchoredAt ? new Date(receipt.anchoredAt) : undefined,
            status,
            providerReceipt: receipt.providerReceipt as Prisma.InputJsonValue | undefined,
          },
        });
        await transaction.content.update({ where: { id: created.content.id }, data: { status: status === 'FAILED' ? 'FAILED' : 'READY' } });
        const certificate = await transaction.certificate.create({
          data: {
            contentId: created.content.id,
            provenanceRecordId: provenance.id,
            certificateNumber: `AV-${new Date().getUTCFullYear()}-${provenance.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`,
            publicVerificationUrl: `${this.config.APP_ORIGIN}/verify`,
            shareTokenHash: sha256(shareToken),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        await this.audit.append({ userId, action: 'PROOF_SUBMITTED', resource: 'ProvenanceRecord', resourceId: provenance.id, metadata: { transactionHash: receipt.transactionHash, network: receipt.network } }, transaction);
        return { provenance, certificate };
      });
      return {
        content: this.contentDto(created.content),
        proof: this.proofDto(updated.provenance),
        certificate: { ...this.certificateDto(updated.certificate), publicVerificationUrl: `${this.config.APP_ORIGIN}/verify/${shareToken}`, shareToken },
        duplicateNotice: publicDuplicate ? { type: 'PUBLIC', proofId: publicDuplicate.proofId, message: 'This exact file has previously been registered in a public proof.' } : null,
      };
    } catch (error) {
      await this.database.provenanceRecord.update({ where: { id: created.provenance.id }, data: { status: 'FAILED' } });
      await this.database.content.update({ where: { id: created.content.id }, data: { status: 'FAILED' } });
      throw error;
    }
  }

  async status(userId: string, proofId: string) {
    const record = await this.ownedProof(userId, proofId);
    return this.proofDto(record);
  }

  async registerVersion(userId: string, contentId: string, input: RegisterVersionInput) {
    const [content, upload] = await Promise.all([
      this.database.content.findUnique({ where: { id: contentId }, include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } } }),
      this.database.upload.findUnique({ where: { id: input.uploadId } }),
    ]);
    if (!content) throw new NotFoundError('Content');
    if (!upload) throw new NotFoundError('Upload');
    if (content.ownerId !== userId || upload.ownerId !== userId) throw new ForbiddenError();
    if (upload.contentId) throw new ConflictError('Upload has already been registered');
    if (upload.status !== 'CLEAN' || !upload.expectedHash) throw new ConflictError('Upload must be finalized and clean before version registration');
    if (await this.database.contentVersion.findFirst({ where: { contentId, hash: upload.expectedHash } })) {
      throw new ConflictError('This exact file already exists in the version history');
    }
    const versionNumber = (content.versions[0]?.versionNumber ?? 0) + 1;
    const proofId = randomProofId();
    const metadataHash = sha256(canonicalJson({
      schema: 'authivara-metadata/v1', contentId, version: versionNumber, label: input.label ?? null,
      description: input.description ?? null, tags: input.tags ?? [],
    }));
    const provenance = await this.database.$transaction(async (transaction) => {
      const version = await transaction.contentVersion.create({
        data: {
          contentId, versionNumber, label: input.label, hash: upload.expectedHash!,
          fileName: upload.fileName, mimeType: upload.detectedMime ?? upload.declaredMime, fileSize: upload.fileSize,
          description: input.description, tags: input.tags ?? content.tags, storageKey: upload.storageKey, metadataHash, createdBy: userId,
        },
      });
      const proof = await transaction.provenanceRecord.create({
        data: { contentId, contentVersionId: version.id, proofId, hash: upload.expectedHash!, metadataHash, blockchainNetwork: this.blockchain.network },
      });
      await transaction.upload.update({ where: { id: upload.id }, data: { contentId } });
      await transaction.content.update({
        where: { id: contentId },
        data: {
          fileName: upload.fileName, mimeType: upload.detectedMime ?? upload.declaredMime, fileSize: upload.fileSize,
          description: input.description ?? content.description, tags: input.tags ?? content.tags,
          storageKey: upload.storageKey, contentHash: upload.expectedHash!, status: 'PROCESSING',
        },
      });
      await this.audit.append({ userId, action: 'CONTENT_VERSION_CREATED', resource: 'ContentVersion', resourceId: version.id, metadata: { contentId, versionNumber, contentHash: upload.expectedHash! } }, transaction);
      return proof;
    });
    try {
      const receipt = await this.blockchain.registerProof({ proofId, contentHash: provenance.hash, metadataHash, version: versionNumber, timestamp: provenance.timestamp.toISOString() });
      const shareToken = randomToken();
      const result = await this.database.$transaction(async (transaction) => {
        const proof = await transaction.provenanceRecord.update({
          where: { id: provenance.id },
          data: {
            transactionHash: receipt.transactionHash, blockNumber: receipt.blockNumber,
            submittedAt: new Date(receipt.submittedAt), anchoredAt: receipt.anchoredAt ? new Date(receipt.anchoredAt) : undefined,
            status: this.mapStatus(receipt.status), providerReceipt: receipt.providerReceipt as Prisma.InputJsonValue | undefined,
          },
        });
        const certificate = await transaction.certificate.create({
          data: {
            contentId, provenanceRecordId: proof.id,
            certificateNumber: `AV-${new Date().getUTCFullYear()}-${proof.id.replaceAll('-', '').slice(0, 12).toUpperCase()}`,
            publicVerificationUrl: `${this.config.APP_ORIGIN}/verify`,
            shareTokenHash: sha256(shareToken),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        await transaction.content.update({ where: { id: contentId }, data: { status: proof.status === 'FAILED' ? 'FAILED' : 'READY' } });
        return { proof, certificate };
      });
      return { versionNumber, proof: this.proofDto(result.proof), certificate: { ...this.certificateDto(result.certificate), publicVerificationUrl: `${this.config.APP_ORIGIN}/verify/${shareToken}`, shareToken } };
    } catch (error) {
      await this.database.provenanceRecord.update({ where: { id: provenance.id }, data: { status: 'FAILED' } });
      await this.database.content.update({ where: { id: contentId }, data: { status: 'FAILED' } });
      throw error;
    }
  }

  async refreshStatus(userId: string, proofId: string) {
    const record = await this.ownedProof(userId, proofId);
    if (!record.transactionHash) return this.proofDto(record);
    const receipt = await this.blockchain.getTransactionStatus(record.transactionHash);
    const updated = await this.database.provenanceRecord.update({
      where: { id: record.id },
      data: {
        status: this.mapStatus(receipt.status),
        blockNumber: receipt.blockNumber,
        anchoredAt: receipt.anchoredAt ? new Date(receipt.anchoredAt) : undefined,
        providerReceipt: receipt.providerReceipt as Prisma.InputJsonValue | undefined,
      },
    });
    return this.proofDto(updated);
  }

  private async ownedProof(userId: string, proofId: string) {
    const record = await this.database.provenanceRecord.findUnique({ where: { proofId }, include: { content: true } });
    if (!record) throw new NotFoundError('Proof');
    if (record.content.ownerId !== userId) throw new ForbiddenError();
    return record;
  }

  private mapStatus(status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED'): ProofStatus {
    return status;
  }

  private toRegistration(content: { id: string; title: string; contentHash: string; provenance: Array<{ proofId: string; status: ProofStatus; transactionHash: string | null }>; certificates: Array<{ certificateNumber: string; publicVerificationUrl: string }> }) {
    const proof = content.provenance[0];
    const certificate = content.certificates[0];
    return {
      content: { id: content.id, title: content.title, contentHash: content.contentHash },
      proof: proof ? { proofId: proof.proofId, status: proof.status, transactionHash: proof.transactionHash } : null,
      certificate: certificate ? { certificateNumber: certificate.certificateNumber, publicVerificationUrl: certificate.publicVerificationUrl } : null,
    };
  }

  private contentDto(content: { id: string; title: string; category: string; fileName: string; mimeType: string; fileSize: bigint; contentHash: string; hashAlgorithm: string; visibility: string; status: string; createdAt: Date }) {
    return {
      id: content.id,
      title: content.title,
      category: content.category,
      fileName: content.fileName,
      mimeType: content.mimeType,
      fileSize: Number(content.fileSize),
      contentHash: content.contentHash,
      hashAlgorithm: content.hashAlgorithm,
      visibility: content.visibility,
      status: content.status,
      createdAt: content.createdAt,
    };
  }

  private proofDto(proof: { proofId: string; hash: string; metadataHash: string | null; blockchainNetwork: string; transactionHash: string | null; blockNumber: bigint | null; timestamp: Date; submittedAt: Date | null; anchoredAt: Date | null; status: ProofStatus }) {
    return {
      proofId: proof.proofId,
      hash: proof.hash,
      metadataHash: proof.metadataHash,
      blockchainNetwork: proof.blockchainNetwork,
      transactionHash: proof.transactionHash,
      blockNumber: proof.blockNumber?.toString() ?? null,
      timestamp: proof.timestamp,
      submittedAt: proof.submittedAt,
      anchoredAt: proof.anchoredAt,
      status: proof.status,
    };
  }

  private certificateDto(certificate: { id: string; certificateNumber: string; publicVerificationUrl: string; generatedAt: Date; expiresAt: Date | null; status: string }) {
    return {
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      publicVerificationUrl: certificate.publicVerificationUrl,
      generatedAt: certificate.generatedAt,
      expiresAt: certificate.expiresAt,
      status: certificate.status,
    };
  }
}
