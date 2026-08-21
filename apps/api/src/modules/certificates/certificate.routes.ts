import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';
import { requireUser } from '../../shared/request-context.js';
import type { AppConfig } from '../../config.js';
import { randomToken, sha256 } from '../../shared/crypto.js';
import type { AuditService } from '../audit/audit.service.js';
import { CertificateService } from './certificate.service.js';

const paramsSchema = z.object({ certificateNumber: z.string().min(8).max(80) });
const shareSchema = z.object({ expiresInHours: z.number().int().min(1).max(24 * 30).default(24 * 7) });

export async function registerCertificateRoutes(app: FastifyInstance, database: PrismaClient, config: AppConfig, audit: AuditService) {
  const certificates = new CertificateService(database, config, audit);
  app.get('/v1/certificates/:certificateNumber', { preHandler: requireUser }, async (request) => {
    const { certificateNumber } = paramsSchema.parse(request.params);
    const certificate = await database.certificate.findUnique({
      where: { certificateNumber },
      include: { content: true, provenance: true },
    });
    if (!certificate) throw new NotFoundError('Certificate');
    if (certificate.content.ownerId !== request.authUser!.id) throw new ForbiddenError();
    return {
      schema: 'authivara-certificate/v1',
      evidenceNotice: 'Evidence of file existence and account submission; not a legal ownership judgment.',
      certificate: {
        number: certificate.certificateNumber,
        generatedAt: certificate.generatedAt,
        status: certificate.status,
        publicVerificationUrl: certificate.publicVerificationUrl,
      },
      content: {
        id: certificate.content.id,
        title: certificate.content.title,
        category: certificate.content.category,
        fileName: certificate.content.fileName,
        fileSize: Number(certificate.content.fileSize),
      },
      proof: {
        proofId: certificate.provenance.proofId,
        hash: certificate.provenance.hash,
        hashAlgorithm: certificate.content.hashAlgorithm,
        metadataHash: certificate.provenance.metadataHash,
        network: certificate.provenance.blockchainNetwork,
        transactionHash: certificate.provenance.transactionHash,
        blockNumber: certificate.provenance.blockNumber?.toString() ?? null,
        timestamp: certificate.provenance.timestamp,
        anchoredAt: certificate.provenance.anchoredAt,
        status: certificate.provenance.status,
      },
    };
  });

  app.post('/v1/certificates/:certificateNumber/share', { preHandler: requireUser }, async (request) => {
    const { certificateNumber } = paramsSchema.parse(request.params);
    const { expiresInHours } = shareSchema.parse(request.body ?? {});
    const certificate = await database.certificate.findUnique({ where: { certificateNumber }, include: { content: true, provenance: true } });
    if (!certificate) throw new NotFoundError('Certificate');
    if (certificate.content.ownerId !== request.authUser!.id) throw new ForbiddenError();
    if (certificate.content.visibility === 'PUBLIC') {
      await audit.append({ userId: request.authUser!.id, action: 'PUBLIC_PROOF_SHARED', resource: 'Certificate', resourceId: certificate.id });
      return { publicVerificationUrl: `${config.APP_ORIGIN}/proof/${certificate.provenance.proofId}`, expiresAt: null };
    }
    const shareToken = randomToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    await database.$transaction(async (transaction) => {
      await transaction.certificate.update({
        where: { id: certificate.id },
        data: { shareTokenHash: sha256(shareToken), expiresAt },
      });
      await audit.append({ userId: request.authUser!.id, action: 'CERTIFICATE_SHARE_ROTATED', resource: 'Certificate', resourceId: certificate.id }, transaction);
    });
    return { publicVerificationUrl: `${config.APP_ORIGIN}/verify/${shareToken}`, shareToken, expiresAt };
  });

  app.get('/v1/certificates/:certificateNumber/pdf', { preHandler: requireUser }, async (request, reply) => {
    const { certificateNumber } = paramsSchema.parse(request.params);
    const pdf = await certificates.forOwner(request.authUser!.id, certificateNumber);
    return reply.type('application/pdf').header('content-disposition', `attachment; filename="${pdf.filename}"`).send(Buffer.from(pdf.bytes));
  });

  app.get('/v1/public/proofs/id/:proofId/certificate.pdf', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { proofId } = z.object({ proofId: z.string().regex(/^PCA-[A-Z0-9]{8,24}$/) }).parse(request.params);
    const pdf = await certificates.forPublicProof(proofId);
    return reply.type('application/pdf').header('content-disposition', `attachment; filename="${pdf.filename}"`).send(Buffer.from(pdf.bytes));
  });

  app.delete('/v1/certificates/:certificateNumber/share', { preHandler: requireUser }, async (request, reply) => {
    const { certificateNumber } = paramsSchema.parse(request.params);
    const certificate = await database.certificate.findUnique({ where: { certificateNumber }, include: { content: true } });
    if (!certificate) throw new NotFoundError('Certificate');
    if (certificate.content.ownerId !== request.authUser!.id) throw new ForbiddenError();
    await database.$transaction(async (transaction) => {
      await transaction.certificate.update({
        where: { id: certificate.id },
        data: { shareTokenHash: sha256(randomToken()), expiresAt: new Date() },
      });
      await audit.append({ userId: request.authUser!.id, action: 'CERTIFICATE_SHARE_REVOKED', resource: 'Certificate', resourceId: certificate.id }, transaction);
    });
    reply.code(204).send();
  });
}
