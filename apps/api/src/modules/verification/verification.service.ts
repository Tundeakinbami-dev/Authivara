import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../../config.js';
import { privacyHash, sha256 } from '../../shared/crypto.js';
import { NotFoundError } from '../../shared/errors.js';
import type { BlockchainProvider } from '../blockchain/blockchain-provider.js';

export interface VerificationContext {
  requester?: string;
  ip?: string;
  userAgent?: string;
}

export class VerificationService {
  constructor(
    private readonly database: PrismaClient,
    private readonly config: AppConfig,
    private readonly blockchain: BlockchainProvider,
  ) {}

  async inspect(shareToken: string) {
    const certificate = await this.findCertificate(shareToken);
    return { certificate: this.publicCertificate(certificate) };
  }

  async verify(shareToken: string, submittedHash: string, context: VerificationContext) {
    const certificate = await this.findCertificate(shareToken);
    const revoked = certificate.status === 'REVOKED' || certificate.provenance.status === 'REVOKED';
    const matches = certificate.provenance.hash === submittedHash.toLowerCase();
    const anchorVerified = matches && Boolean(certificate.provenance.transactionHash) && await this.blockchain
      .verifyProof(submittedHash.toLowerCase(), certificate.provenance.transactionHash!)
      .catch(() => false);
    const result = revoked ? 'REVOKED' : matches ? 'MATCH' : 'NO_MATCH';
    await this.database.verificationEvent.create({
      data: {
        proofId: certificate.provenance.proofId,
        submittedHash: submittedHash.toLowerCase(),
        result,
        requester: context.requester?.slice(0, 200),
        ipHash: context.ip ? privacyHash(context.ip, this.config.PRIVACY_HASH_SECRET) : undefined,
        userAgent: context.userAgent?.slice(0, 512),
      },
    });
    return {
      result,
      exactMatch: matches,
      anchorVerified,
      certificate: this.publicCertificate(certificate),
      notice: 'A match confirms byte-for-byte integrity against the timestamped proof; it does not adjudicate copyright ownership.',
    };
  }

  async inspectPublicProof(proofId: string) {
    const proof = await this.findPublicProof(proofId);
    const anchorVerified = Boolean(proof.transactionHash) && await this.blockchain.verifyProof(proof.hash, proof.transactionHash!).catch(() => false);
    return { proof: this.publicProof(proof), timeline: this.timeline(proof.content.versions), anchorVerified };
  }

  async verifyPublic(submittedHashInput: string, proofId: string | undefined, context: VerificationContext) {
    const submittedHash = submittedHashInput.toLowerCase();
    if (proofId) {
      const proof = await this.database.provenanceRecord.findUnique({
        where: { proofId },
        include: this.publicProofInclude(),
      });
      if (!proof || proof.content.visibility !== 'PUBLIC') {
        return { result: 'INVALID_PROOF' as const, exactMatch: false, anchorVerified: false, notice: 'The supplied proof ID could not be validated.' };
      }
      return this.compareWithProof(proof, submittedHash, context);
    }
    const proof = await this.database.provenanceRecord.findFirst({
      where: { hash: submittedHash, content: { visibility: 'PUBLIC' } },
      orderBy: { timestamp: 'desc' },
      include: this.publicProofInclude(),
    });
    if (!proof) return { result: 'NO_MATCH' as const, exactMatch: false, anchorVerified: false, notice: 'No matching public proof was found for this exact file.' };
    return this.compareWithProof(proof, submittedHash, context);
  }

  private async compareWithProof(
    proof: Awaited<ReturnType<VerificationService['findPublicProof']>>,
    submittedHash: string,
    context: VerificationContext,
  ) {
    const revoked = proof.status === 'REVOKED' || proof.certificate?.status === 'REVOKED';
    const exactMatch = proof.hash === submittedHash;
    const relatedVersion = !exactMatch
      ? proof.content.versions.find((version) => version.hash === submittedHash)
      : undefined;
    const result = revoked ? 'REVOKED' : exactMatch ? 'MATCH' : relatedVersion ? 'RELATED_VERSION' : 'NO_MATCH';
    const anchorVerified = exactMatch && Boolean(proof.transactionHash) && await this.blockchain
      .verifyProof(submittedHash, proof.transactionHash!)
      .catch(() => false);
    await this.database.verificationEvent.create({
      data: {
        proofId: proof.proofId,
        submittedHash,
        result,
        requester: context.requester?.slice(0, 200),
        ipHash: context.ip ? privacyHash(context.ip, this.config.PRIVACY_HASH_SECRET) : undefined,
        userAgent: context.userAgent?.slice(0, 512),
      },
    });
    const notices = {
      MATCH: 'The uploaded file matches the registered cryptographic fingerprint.',
      RELATED_VERSION: 'The uploaded file matches an earlier or later registered version of this work.',
      NO_MATCH: 'The uploaded file does not match this proof or any registered version of the work.',
      REVOKED: 'The file fingerprint matched, but this proof or certificate has been revoked.',
    } as const;
    return {
      result,
      exactMatch,
      anchorVerified,
      relatedVersion: relatedVersion ? {
        versionNumber: relatedVersion.versionNumber,
        proofId: relatedVersion.provenance[0]?.proofId ?? null,
        registeredAt: relatedVersion.provenance[0]?.timestamp ?? relatedVersion.createdAt,
      } : null,
      proof: this.publicProof(proof),
      notice: notices[result],
    };
  }

  private async findPublicProof(proofId: string) {
    const proof = await this.database.provenanceRecord.findUnique({
      where: { proofId },
      include: this.publicProofInclude(),
    });
    if (!proof || proof.content.visibility !== 'PUBLIC') throw new NotFoundError('Public proof');
    return proof;
  }

  private publicProofInclude() {
    return {
      certificate: true,
      content: {
        include: {
          versions: { orderBy: { versionNumber: 'asc' as const }, include: { provenance: { orderBy: { timestamp: 'asc' as const } } } },
        },
      },
    } as const;
  }

  private publicProof(proof: Awaited<ReturnType<VerificationService['findPublicProof']>>) {
    return {
      heading: 'Proof of Content Authorship',
      status: proof.status,
      content: { title: proof.content.title, type: proof.content.category },
      registeredAt: proof.timestamp,
      proofId: proof.proofId,
      hashAlgorithm: 'SHA-256',
      contentHash: proof.hash,
      metadataHash: proof.metadataHash,
      blockchain: proof.blockchainNetwork,
      transactionHash: proof.transactionHash,
      blockchainUrl: this.config.ANCHOR_EXPLORER_URL && proof.transactionHash
        ? `${this.config.ANCHOR_EXPLORER_URL.replace(/\/$/, '')}/${encodeURIComponent(proof.transactionHash)}`
        : null,
      blockNumber: proof.blockNumber?.toString() ?? null,
      submittedAt: proof.submittedAt,
      confirmedAt: proof.anchoredAt,
      certificate: proof.certificate ? {
        certificateNumber: proof.certificate.certificateNumber,
        generatedAt: proof.certificate.generatedAt,
        status: proof.certificate.status,
      } : null,
      publicUrl: `${this.config.APP_ORIGIN}/proof/${proof.proofId}`,
    };
  }

  private timeline(versions: Awaited<ReturnType<VerificationService['findPublicProof']>>['content']['versions']) {
    return versions.flatMap((version) => {
      const proof = version.provenance[0];
      const events = [{ type: 'VERSION_CREATED', timestamp: version.createdAt, title: `Version ${version.versionNumber} created`, detail: 'Exact file bytes fingerprinted with SHA-256.' }];
      if (proof) {
        events.push({ type: 'PROOF_REGISTERED', timestamp: proof.timestamp, title: `Version ${version.versionNumber} proof registered`, detail: proof.proofId });
        if (proof.anchoredAt) events.push({ type: 'BLOCKCHAIN_CONFIRMED', timestamp: proof.anchoredAt, title: `Version ${version.versionNumber} blockchain confirmed`, detail: proof.blockchainNetwork });
      }
      return events;
    }).sort((left, right) => +left.timestamp - +right.timestamp);
  }

  private findCertificate(shareToken: string) {
    return this.database.certificate.findUnique({
      where: { shareTokenHash: sha256(shareToken) },
      include: {
        provenance: true,
        content: { include: { owner: { include: { creatorProfile: true } } } },
      },
    }).then((certificate) => {
      if (!certificate || certificate.expiresAt && certificate.expiresAt <= new Date()) throw new NotFoundError('Verification link');
      return certificate;
    });
  }

  private publicCertificate(certificate: Awaited<ReturnType<VerificationService['findCertificate']>>) {
    return {
      certificateNumber: certificate.certificateNumber,
      generatedAt: certificate.generatedAt,
      status: certificate.status,
      content: {
        title: certificate.content.title,
        category: certificate.content.category,
        visibility: certificate.content.visibility,
        creator: certificate.content.visibility === 'PUBLIC' ? certificate.content.owner.creatorProfile?.displayName ?? certificate.content.owner.name : undefined,
      },
      proof: {
        proofId: certificate.provenance.proofId,
        hashAlgorithm: 'SHA-256',
        contentHash: certificate.provenance.hash,
        metadataHash: certificate.provenance.metadataHash,
        network: certificate.provenance.blockchainNetwork,
        transactionHash: certificate.provenance.transactionHash,
        blockNumber: certificate.provenance.blockNumber?.toString() ?? null,
        submittedAt: certificate.provenance.submittedAt,
        anchoredAt: certificate.provenance.anchoredAt,
        status: certificate.provenance.status,
      },
    };
  }
}
