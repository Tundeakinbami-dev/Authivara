import { Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { StellarAnchorProvider } from '../src/modules/blockchain/stellar.provider.js';

const keypair = Keypair.random();
const digest = 'a'.repeat(64);

function horizonMock() {
  let submitted: unknown;
  return {
    client: {
      loadAccount: async () => ({ accountId: () => keypair.publicKey(), sequenceNumber: () => '1', incrementSequenceNumber() {} }),
      fetchBaseFee: async () => 100,
      submitTransaction: async (transaction: unknown) => {
        submitted = transaction;
        return { hash: 'f'.repeat(64), successful: true, created_at: '2026-10-12T12:00:00Z', ledger_attr: 12345 };
      },
      transactions: () => ({ transaction: () => ({ call: async () => ({ hash: 'f'.repeat(64), successful: true, created_at: '2026-10-12T12:00:00Z', ledger_attr: 12345 }) }) }),
      operations: () => ({ forTransaction: () => ({ call: async () => ({ records: [{ type: 'manage_data', name: 'authivara-proof:PCA-TEST', value: Buffer.from(digest).toString('base64') }] }) }) }),
    },
    get submitted() { return submitted; },
  };
}

describe('StellarAnchorProvider', () => {
  it('submits a signed testnet manage-data anchor containing only the SHA-256 digest', async () => {
    const mock = horizonMock();
    const provider = new StellarAnchorProvider({
      horizonUrl: 'https://horizon-testnet.stellar.org', networkPassphrase: 'Test SDF Network ; September 2015',
      anchorAccount: keypair.publicKey(), anchorSecret: keypair.secret(),
    }, mock.client);

    const receipt = await provider.registerProof({ proofId: 'PCA-TEST', contentHash: digest, version: 1, timestamp: '2026-10-12T12:00:00Z' });
    expect(receipt).toMatchObject({ network: 'Stellar Testnet', transactionHash: 'f'.repeat(64), status: 'CONFIRMED', blockNumber: 12345n });
    expect(mock.submitted).toBeDefined();
    expect(receipt.providerReceipt).toEqual({ dataKey: 'authivara-proof:PCA-TEST', digest });
  });

  it('verifies the digest from the transaction operations returned by Horizon', async () => {
    const mock = horizonMock();
    const provider = new StellarAnchorProvider({
      horizonUrl: 'https://horizon-testnet.stellar.org', networkPassphrase: 'Test SDF Network ; September 2015',
      anchorAccount: keypair.publicKey(), anchorSecret: keypair.secret(),
    }, mock.client);
    await expect(provider.verifyProof(digest, 'f'.repeat(64))).resolves.toBe(true);
    await expect(provider.verifyProof('b'.repeat(64), 'f'.repeat(64))).resolves.toBe(false);
  });

  it('rejects an account/secret mismatch before any transaction can be sent', () => {
    expect(() => new StellarAnchorProvider({
      horizonUrl: 'https://horizon-testnet.stellar.org', networkPassphrase: 'Test SDF Network ; September 2015',
      anchorAccount: Keypair.random().publicKey(), anchorSecret: keypair.secret(),
    })).toThrow('does not match');
  });
});
