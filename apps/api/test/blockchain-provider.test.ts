import { describe, expect, it } from 'vitest';
import { SandboxBlockchainProvider } from '../src/modules/blockchain/sandbox.provider.js';

describe('blockchain provider contract', () => {
  it('anchors only the proof envelope fields and returns a trackable receipt', async () => {
    const provider = new SandboxBlockchainProvider();
    const receipt = await provider.registerProof({
      proofId: 'PCA-ABCDEF123456', contentHash: 'a'.repeat(64), metadataHash: 'b'.repeat(64), version: 1,
      timestamp: '2026-08-21T00:00:00.000Z',
    });
    expect(receipt.status).toBe('CONFIRMED');
    expect(receipt.transactionHash).toMatch(/^sandbox_[a-f0-9]{64}$/);
    expect(Object.keys(receipt)).not.toContain('originalFile');
  });
});
