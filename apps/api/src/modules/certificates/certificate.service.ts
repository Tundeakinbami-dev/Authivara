import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../../config.js';
import { randomToken, sha256 } from '../../shared/crypto.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';
import type { AuditService } from '../audit/audit.service.js';
import { generateCertificatePdf } from './pdf-certificate.js';

export class CertificateService {
  constructor(private readonly database: PrismaClient, private readonly config: AppConfig, private readonly audit: AuditService) {}

  async forOwner(userId: string, certificateNumber: string) {
    const certificate = await this.findByNumber(certificateNumber);
    if (certificate.content.ownerId !== userId) throw new ForbiddenError();
    const verificationUrl = certificate.content.visibility === 'PUBLIC'
      ? `${this.config.APP_ORIGIN}/proof/${certificate.provenance.proofId}`
      : await this.issueDurablePrivateLink(userId, certificate);
    return { bytes: await this.render(certificate, verificationUrl), filename: `${certificate.certificateNumber}.pdf` };
  }

  async forPublicProof(proofId: string) {
    const certificate = await this.database.certificate.findFirst({
      where: { provenance: { proofId }, content: { visibility: 'PUBLIC' } },
      include: { provenance: true, content: { include: { owner: { include: { creatorProfile: true } } } } },
    });
    if (!certificate) throw new NotFoundError('Public certificate');
    return { bytes: await this.render(certificate, `${this.config.APP_ORIGIN}/proof/${proofId}`), filename: `${certificate.certificateNumber}.pdf` };
  }

  private findByNumber(certificateNumber: string) {
    return this.database.certificate.findUnique({
      where: { certificateNumber },
      include: { provenance: true, content: { include: { owner: { include: { creatorProfile: true } } } } },
    }).then((certificate) => {
      if (!certificate) throw new NotFoundError('Certificate');
      return certificate;
    });
  }

  private async issueDurablePrivateLink(userId: string, certificate: Awaited<ReturnType<CertificateService['findByNumber']>>) {
    const token = randomToken();
    await this.database.$transaction(async (transaction) => {
      await transaction.certificate.update({ where: { id: certificate.id }, data: { shareTokenHash: sha256(token), expiresAt: null } });
      await this.audit.append({ userId, action: 'CERTIFICATE_PDF_ISSUED', resource: 'Certificate', resourceId: certificate.id }, transaction);
    });
    return `${this.config.APP_ORIGIN}/verify/${token}`;
  }

  private render(certificate: Awaited<ReturnType<CertificateService['findByNumber']>>, verificationUrl: string) {
    return generateCertificatePdf({
      creator: certificate.content.owner.creatorProfile?.displayName ?? certificate.content.owner.name,
      workTitle: certificate.content.title,
      proofId: certificate.provenance.proofId,
      contentHash: certificate.provenance.hash,
      registeredAt: certificate.provenance.timestamp,
      blockchainNetwork: certificate.provenance.blockchainNetwork,
      transactionId: certificate.provenance.transactionHash,
      verificationUrl,
      certificateNumber: certificate.certificateNumber,
      issuedAt: certificate.generatedAt,
    });
  }
}
