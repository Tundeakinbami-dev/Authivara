import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireUser } from '../../shared/request-context.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';
import type { AuditService } from '../audit/audit.service.js';

const paramsSchema = z.object({ contentId: z.uuid() });
const compareSchema = z.object({ from: z.coerce.number().int().positive(), to: z.coerce.number().int().positive() });

export async function registerContentRoutes(app: FastifyInstance, database: PrismaClient, audit: AuditService) {
  app.get('/v1/content', { preHandler: requireUser }, async (request) => {
    const content = await database.content.findMany({
      where: { ownerId: request.authUser!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        provenance: { orderBy: { timestamp: 'desc' }, take: 1 },
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        certificates: { orderBy: { generatedAt: 'desc' }, take: 1 },
      },
    });
    return {
      content: content.map((item) => ({
        id: item.id, title: item.title, description: item.description, category: item.category, tags: item.tags,
        fileName: item.fileName, mimeType: item.mimeType, fileSize: Number(item.fileSize),
        contentHash: item.contentHash, hashAlgorithm: item.hashAlgorithm, status: item.status,
        visibility: item.visibility, createdAt: item.createdAt, updatedAt: item.updatedAt,
        versionNumber: item.versions[0]?.versionNumber ?? 1,
        proof: item.provenance[0] ? {
          proofId: item.provenance[0].proofId,
          status: item.provenance[0].status,
          network: item.provenance[0].blockchainNetwork,
          transactionHash: item.provenance[0].transactionHash,
          timestamp: item.provenance[0].timestamp,
        } : null,
        certificate: item.certificates[0] ? {
          certificateNumber: item.certificates[0].certificateNumber,
          publicVerificationUrl: item.certificates[0].publicVerificationUrl,
        } : null,
      })),
    };
  });

  app.get('/v1/content/:contentId/versions', { preHandler: requireUser }, async (request) => {
    const { contentId } = paramsSchema.parse(request.params);
    const content = await database.content.findUnique({
      where: { id: contentId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: { provenance: true, creator: { select: { id: true, name: true, username: true } } },
        },
      },
    });
    if (!content) throw new NotFoundError('Content');
    if (content.ownerId !== request.authUser!.id) throw new ForbiddenError();
    return {
      versions: content.versions.map((version) => ({
        id: version.id, versionNumber: version.versionNumber, label: version.label, hash: version.hash,
        hashAlgorithm: version.hashAlgorithm, metadataHash: version.metadataHash, createdAt: version.createdAt,
        fileName: version.fileName, mimeType: version.mimeType, fileSize: Number(version.fileSize),
        description: version.description, tags: version.tags, creator: version.creator,
        proof: version.provenance[0] ? {
          proofId: version.provenance[0].proofId, status: version.provenance[0].status,
          network: version.provenance[0].blockchainNetwork, transactionHash: version.provenance[0].transactionHash,
        } : null,
      })),
    };
  });

  app.get('/v1/content/:contentId/versions/compare', { preHandler: requireUser }, async (request) => {
    const { contentId } = paramsSchema.parse(request.params);
    const { from, to } = compareSchema.parse(request.query);
    const content = await database.content.findUnique({
      where: { id: contentId },
      include: { versions: { where: { versionNumber: { in: [from, to] } }, include: { creator: { select: { name: true, username: true } } } } },
    });
    if (!content) throw new NotFoundError('Content');
    await requireContentAccess(database, content.ownerId, content.organizationId, request.authUser!.id);
    const left = content.versions.find((version) => version.versionNumber === from);
    const right = content.versions.find((version) => version.versionNumber === to);
    if (!left || !right) throw new NotFoundError('Content version');
    const fields = ['label', 'fileName', 'mimeType', 'fileSize', 'description', 'tags'] as const;
    const differences = fields.filter((field) => normalize(left[field]) !== normalize(right[field]));
    return {
      from: versionComparisonDto(left),
      to: versionComparisonDto(right),
      comparison: {
        exactBytesEqual: left.hash === right.hash,
        hashesMatch: left.hash === right.hash,
        metadataDifferences: differences,
        notice: left.hash === right.hash
          ? 'The SHA-256 hashes match, so the stored file bytes are cryptographically identical.'
          : 'The SHA-256 hashes differ. These versions are materially different files; metadata similarity is not cryptographic equivalence.',
      },
    };
  });

  app.patch('/v1/content/:contentId/archive', { preHandler: requireUser }, async (request) => {
    const { contentId } = paramsSchema.parse(request.params);
    const content = await database.content.findUnique({ where: { id: contentId } });
    if (!content) throw new NotFoundError('Content');
    await requireContentAccess(database, content.ownerId, content.organizationId, request.authUser!.id, true);
    const archived = await database.$transaction(async (transaction) => {
      const updated = await transaction.content.update({ where: { id: contentId }, data: { status: 'ARCHIVED' } });
      await audit.append({
        userId: request.authUser!.id, organizationId: content.organizationId ?? undefined,
        action: 'CONTENT_ARCHIVED', resource: 'Content', resourceId: contentId,
      }, transaction);
      return updated;
    });
    return { content: { id: archived.id, status: archived.status, updatedAt: archived.updatedAt } };
  });

  app.get('/v1/dashboard/summary', { preHandler: requireUser }, async (request) => {
    const ownerId = request.authUser!.id;
    const contentScope = { ownerId, status: { not: 'ARCHIVED' as const } };
    const [totalWorks, confirmedProofs, pendingProofs, licensedContent, verificationRequests, storage] = await Promise.all([
      database.content.count({ where: contentScope }),
      database.provenanceRecord.findMany({ where: { status: 'CONFIRMED', content: contentScope }, distinct: ['contentId'], select: { contentId: true } }),
      database.provenanceRecord.count({ where: { status: { in: ['PENDING', 'SUBMITTED'] }, content: contentScope } }),
      database.license.findMany({ where: { status: 'ACTIVE', content: contentScope }, distinct: ['contentId'], select: { contentId: true } }),
      database.verificationEvent.count({ where: { provenance: { content: contentScope } } }),
      database.contentVersion.aggregate({ where: { content: contentScope }, _sum: { fileSize: true } }),
    ]);
    return {
      totalWorks,
      verifiedWorks: confirmedProofs.length,
      pendingProofs,
      licensedWorks: licensedContent.length,
      verificationRequests,
      storageUsageBytes: Number(storage._sum.fileSize ?? 0n),
    };
  });

  app.get('/v1/content/:contentId/timeline', { preHandler: requireUser }, async (request) => {
    const { contentId } = paramsSchema.parse(request.params);
    const content = await database.content.findUnique({
      where: { id: contentId },
      include: {
        versions: { orderBy: { versionNumber: 'asc' }, include: { provenance: { orderBy: { timestamp: 'asc' } } } },
        licenses: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!content) throw new NotFoundError('Content');
    const membership = content.organizationId
      ? await database.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: content.organizationId, userId: request.authUser!.id } } })
      : null;
    if (content.ownerId !== request.authUser!.id && !membership) throw new ForbiddenError();
    const versionEvents = content.versions.flatMap((version) => {
      const proof = version.provenance[0];
      const events = [{ type: 'VERSION_CREATED', timestamp: version.createdAt, title: `Version ${version.versionNumber} created`, detail: version.hash }];
      if (proof) {
        events.push({ type: 'PROOF_REGISTERED', timestamp: proof.timestamp, title: `Version ${version.versionNumber} registered`, detail: proof.proofId });
        if (proof.anchoredAt) events.push({ type: 'BLOCKCHAIN_CONFIRMED', timestamp: proof.anchoredAt, title: `Version ${version.versionNumber} blockchain confirmed`, detail: proof.blockchainNetwork });
      }
      return events;
    });
    const licenseEvents = content.licenses.flatMap((license) => {
      const events = [{ type: 'LICENSE_CREATED', timestamp: license.createdAt, title: `Licensed to ${license.licensee}`, detail: license.licenseType }];
      if (+license.updatedAt > +license.createdAt + 1000) events.push({ type: 'LICENSE_RENEWED', timestamp: license.updatedAt, title: `Licence renewed for ${license.licensee}`, detail: license.status });
      return events;
    });
    return { timeline: [...versionEvents, ...licenseEvents].sort((left, right) => +left.timestamp - +right.timestamp) };
  });
}

async function requireContentAccess(
  database: PrismaClient,
  ownerId: string,
  organizationId: string | null,
  userId: string,
  requireEditor = false,
) {
  if (ownerId === userId) return;
  if (!organizationId) throw new ForbiddenError();
  const membership = await database.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership || (requireEditor && membership.role === 'VIEWER')) throw new ForbiddenError();
}

function versionComparisonDto(version: {
  versionNumber: number; label: string | null; hash: string; hashAlgorithm: string; fileName: string;
  mimeType: string; fileSize: bigint; description: string | null; tags: string[]; createdAt: Date;
  creator: { name: string; username: string };
}) {
  return {
    versionNumber: version.versionNumber, label: version.label, hash: version.hash, hashAlgorithm: version.hashAlgorithm,
    fileName: version.fileName, mimeType: version.mimeType, fileSize: Number(version.fileSize),
    description: version.description, tags: version.tags, createdAt: version.createdAt, creator: version.creator,
  };
}

function normalize(value: unknown) {
  return typeof value === 'bigint' ? value.toString() : JSON.stringify(value);
}
