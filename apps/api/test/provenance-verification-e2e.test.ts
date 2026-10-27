import { Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { StellarAnchorProvider } from '../src/modules/blockchain/stellar.provider.js';
import { canonicalJson, randomProofId, randomToken, sha256 } from '../src/shared/crypto.js';

describe('End-to-End Cryptographic Provenance & Verification', () => {
  const kp = Keypair.random();
  const recordedOperations: Array<{ type: string; name: string; value: string }> = [];

  const horizonClientMock = {
    loadAccount: async () => ({
      accountId: () => kp.publicKey(),
      sequenceNumber: () => '100',
      incrementSequenceNumber() {},
    }),
    fetchBaseFee: async () => 100,
    submitTransaction: async () => {
      return {
        hash: 'c'.repeat(64),
        successful: true,
        created_at: new Date().toISOString(),
        ledger_attr: 987654,
      };
    },
    transactions: () => ({
      transaction: () => ({
        call: async () => ({
          hash: 'c'.repeat(64),
          successful: true,
          created_at: new Date().toISOString(),
          ledger_attr: 987654,
        }),
      }),
    }),
    operations: () => ({
      forTransaction: () => ({
        call: async () => ({
          records: recordedOperations,
        }),
      }),
    }),
  };

  const provider = new StellarAnchorProvider({
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    anchorAccount: kp.publicKey(),
    anchorSecret: kp.secret(),
  }, horizonClientMock);

  it('executes full lifecycle: hashing, canonical metadata, anchoring, and tamper detection', async () => {
    // 1. Original document simulation (e.g. PDF contract or creative design)
    const originalDocument = Buffer.from('CONFIDENTIAL ORIGINAL WORK BY CREATOR - 2026', 'utf-8');
    const originalFingerprint = sha256(originalDocument);
    expect(originalFingerprint).toHaveLength(64);

    // 2. Deterministic hashing: identical bytes produce the same fingerprint
    const copyOfOriginal = Buffer.from('CONFIDENTIAL ORIGINAL WORK BY CREATOR - 2026', 'utf-8');
    expect(sha256(copyOfOriginal)).toBe(originalFingerprint);

    // 3. Single-bit alteration produces a drastically different avalanche hash
    const alteredDocument = Buffer.from('CONFIDENTIAL ORIGINAL WORK BY CREATOR - 2027', 'utf-8');
    const alteredFingerprint = sha256(alteredDocument);
    expect(alteredFingerprint).not.toBe(originalFingerprint);

    // 4. Canonical metadata hashing
    const metadataV1 = {
      title: 'Original Project Manuscript',
      category: 'Document',
      tags: ['stellar', 'wave', 'authorship'],
      visibility: 'PUBLIC' as const,
    };
    const metadataHash = sha256(canonicalJson(metadataV1));
    expect(metadataHash).toHaveLength(64);

    // Ensure key ordering in canonicalJson does not affect hash
    const metadataReordered = {
      visibility: 'PUBLIC' as const,
      category: 'Document',
      tags: ['stellar', 'wave', 'authorship'],
      title: 'Original Project Manuscript',
    };
    expect(sha256(canonicalJson(metadataReordered))).toBe(metadataHash);

    // 5. Generate Proof ID and Anchor on Stellar
    const proofId = randomProofId();
    expect(proofId).toMatch(/^PCA-[A-F0-9]{12}$/);

    // Record mock Horizon operation corresponding to this anchor
    recordedOperations.push({
      type: 'manage_data',
      name: `authivara-proof:${proofId}`,
      value: Buffer.from(originalFingerprint).toString('base64'),
    });

    const receipt = await provider.registerProof({
      proofId,
      contentHash: originalFingerprint,
      metadataHash,
      version: 1,
      timestamp: new Date().toISOString(),
    });

    expect(receipt.status).toBe('CONFIRMED');
    expect(receipt.network).toBe('Stellar Testnet');
    expect(receipt.transactionHash).toBe('c'.repeat(64));
    expect(receipt.blockNumber).toBe(987654n);

    // 6. Independent Verification: Original document matches on-chain anchor
    const verifiedOriginal = await provider.verifyProof(originalFingerprint, receipt.transactionHash, proofId);
    expect(verifiedOriginal).toBe(true);

    // 7. Independent Verification: Altered document fails verification
    const verifiedAltered = await provider.verifyProof(alteredFingerprint, receipt.transactionHash, proofId);
    expect(verifiedAltered).toBe(false);

    // 8. Independent Verification: Wrong proof ID fails strict check
    const verifiedWrongProofId = await provider.verifyProof(originalFingerprint, receipt.transactionHash, 'PCA-000000000000');
    expect(verifiedWrongProofId).toBe(false);
  });

  it('demonstrates version lineage without overwriting previous anchors', async () => {
    const docV1 = Buffer.from('DRAFT SPECIFICATION V1', 'utf-8');
    const hashV1 = sha256(docV1);
    const proofIdV1 = 'PCA-V1TEST000001';

    const docV2 = Buffer.from('DRAFT SPECIFICATION V2 - REVISED FOR STELLAR', 'utf-8');
    const hashV2 = sha256(docV2);
    const proofIdV2 = 'PCA-V2TEST000002';

    recordedOperations.push(
      { type: 'manage_data', name: `authivara-proof:${proofIdV1}`, value: Buffer.from(hashV1).toString('base64') },
      { type: 'manage_data', name: `authivara-proof:${proofIdV2}`, value: Buffer.from(hashV2).toString('base64') },
    );

    // Both proofs remain independently verifiable on ledger
    await expect(provider.verifyProof(hashV1, 'c'.repeat(64), proofIdV1)).resolves.toBe(true);
    await expect(provider.verifyProof(hashV2, 'c'.repeat(64), proofIdV2)).resolves.toBe(true);

    // Cross-verification fails
    await expect(provider.verifyProof(hashV1, 'c'.repeat(64), proofIdV2)).resolves.toBe(false);
    await expect(provider.verifyProof(hashV2, 'c'.repeat(64), proofIdV1)).resolves.toBe(false);
  });
});
