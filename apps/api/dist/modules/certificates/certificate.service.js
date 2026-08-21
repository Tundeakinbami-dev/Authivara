import { randomToken, sha256 } from '../../shared/crypto.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';
import { generateCertificatePdf } from './pdf-certificate.js';
export class CertificateService {
    database;
    config;
    audit;
    constructor(database, config, audit) {
        this.database = database;
        this.config = config;
        this.audit = audit;
    }
    async forOwner(userId, certificateNumber) {
        const certificate = await this.findByNumber(certificateNumber);
        if (certificate.content.ownerId !== userId)
            throw new ForbiddenError();
        const verificationUrl = certificate.content.visibility === 'PUBLIC'
            ? `${this.config.APP_ORIGIN}/proof/${certificate.provenance.proofId}`
            : await this.issueDurablePrivateLink(userId, certificate);
        return { bytes: await this.render(certificate, verificationUrl), filename: `${certificate.certificateNumber}.pdf` };
    }
    async forPublicProof(proofId) {
        const certificate = await this.database.certificate.findFirst({
            where: { provenance: { proofId }, content: { visibility: 'PUBLIC' } },
            include: { provenance: true, content: { include: { owner: { include: { creatorProfile: true } } } } },
        });
        if (!certificate)
            throw new NotFoundError('Public certificate');
        return { bytes: await this.render(certificate, `${this.config.APP_ORIGIN}/proof/${proofId}`), filename: `${certificate.certificateNumber}.pdf` };
    }
    findByNumber(certificateNumber) {
        return this.database.certificate.findUnique({
            where: { certificateNumber },
            include: { provenance: true, content: { include: { owner: { include: { creatorProfile: true } } } } },
        }).then((certificate) => {
            if (!certificate)
                throw new NotFoundError('Certificate');
            return certificate;
        });
    }
    async issueDurablePrivateLink(userId, certificate) {
        const token = randomToken();
        await this.database.$transaction(async (transaction) => {
            await transaction.certificate.update({ where: { id: certificate.id }, data: { shareTokenHash: sha256(token), expiresAt: null } });
            await this.audit.append({ userId, action: 'CERTIFICATE_PDF_ISSUED', resource: 'Certificate', resourceId: certificate.id }, transaction);
        });
        return `${this.config.APP_ORIGIN}/verify/${token}`;
    }
    render(certificate, verificationUrl) {
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
            issuedAt: new Date(),
        });
    }
}
