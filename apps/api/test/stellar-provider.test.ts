import { Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { StellarAnchorProvider } from '../src/modules/blockchain/stellar.provider.js';

const keypair = Keypair.random();
const digest = 'a'.repeat(64);
const otherDigest = 'b'.repeat(64);
const txHash = 'f'.repeat(64);

function horizonMock(overrides?: { failTx?: boolean; notFound?: boolean }) {
  let submitted: unknown;
  return {
    client: {
      loadAccount: async () => ({ accountId: () => keypair.publicKey(), sequenceNumber: () => '1', incrementSequenceNumber() {} }),
      fetchBaseFee: async () => 100,
      submitTransaction: async (transaction: unknown) => {
        submitted = transaction;
        return { hash: txHash, successful: !overrides?.failTx, created_at: '2026-10-12T12:00:00Z', ledger_attr: 12345 };
      },
      transactions: () => ({
        transaction: () => ({
          call: async () => {
            if (overrides?.notFound) throw new Error('Resource Missing');
            return { hash: txHash, successful: !overrides?.failTx, created_at: '2026-10-12T12:00:00Z', ledger_attr: 12345 };
          },
        }),
      }),
      operations: () => ({
        forTransaction: () => ({
          call: async () => {
            if (overrides?.notFound) throw new Error('Resource Missing');
            return {
              records: [
                { type: 'manage_data', name: 'authivara-proof:PCA-TEST', value: Buffer.from(digest).toString('base64') },
              ],
            };
          },
        }),
      }),
    },
    get submitted() { return submitted; },
  };
}

describe('StellarAnchorProvider', () => {
  it('submits a signed testnet manage-data anchor containing only the SHA-256 digest', async () => {
    const mock = horizonMock();
    const provider = new StellarAnchorProvider({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      anchorAccount: keypair.publicKey(),
      anchorSecret: keypair.secret(),
    }, mock.client);

    const receipt = await provider.registerProof({
      proofId: 'PCA-TEST',
      contentHash: digest,
      version: 1,
      timestamp: '2026-10-12T12:00:00Z',
    });
    expect(receipt).toMatchObject({ network: 'Stellar Testnet', transactionHash: txHash, status: 'CONFIRMED', blockNumber: 12345n });
    expect(mock.submitted).toBeDefined();
    expect(receipt.providerReceipt).toEqual({ dataKey: 'authivara-proof:PCA-TEST', digest });
  });

  it('verifies the digest from the transaction operations returned by Horizon', async () => {
    const mock = horizonMock();
    const provider = new StellarAnchorProvider({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      anchorAccount: keypair.publicKey(),
      anchorSecret: keypair.secret(),
    }, mock.client);

    await expect(provider.verifyProof(digest, txHash)).resolves.toBe(true);
    await expect(provider.verifyProof(otherDigest, txHash)).resolves.toBe(false);
  });

  it('supports strict proof-id binding during verification', async () => {
    const mock = horizonMock();
    const provider = new StellarAnchorProvider({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      anchorAccount: keypair.publicKey(),
      anchorSecret: keypair.secret(),
    }, mock.client);

    await expect(provider.verifyProof(digest, txHash, 'PCA-TEST')).resolves.toBe(true);
    await expect(provider.verifyProof(digest, txHash, 'PCA-WRONG')).resolves.toBe(false);
  });

  it('rejects invalid digest formats immediately without querying Horizon', async () => {
    const mock = horizonMock();
    const provider = new StellarAnchorProvider({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      anchorAccount: keypair.publicKey(),
      anchorSecret: keypair.secret(),
    }, mock.client);

    await expect(provider.verifyProof('not-a-sha256', txHash)).resolves.toBe(false);
    await expect(provider.verifyProof('', txHash)).resolves.toBe(false);
    await expect(provider.verifyProof(digest, 'invalid-tx-hash')).resolves.toBe(false);
  });

  it('gracefully handles non-existent or failed Horizon transactions', async () => {
    const notFoundMock = horizonMock({ notFound: true });
    const provider = new StellarAnchorProvider({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      anchorAccount: keypair.publicKey(),
      anchorSecret: keypair.secret(),
    }, notFoundMock.client);

    await expect(provider.verifyProof(digest, txHash)).resolves.toBe(false);

    const status = await provider.getTransactionStatus(txHash);
    expect(status.status).toBe('FAILED');
  });

  it('rejects an account/secret mismatch before any transaction can be sent', () => {
    expect(() => new StellarAnchorProvider({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      anchorAccount: Keypair.random().publicKey(),
      anchorSecret: keypair.secret(),
    })).toThrow('does not match');
  });

  it('rejects registration with invalid content hash or proof id', async () => {
    const mock = horizonMock();
    const provider = new StellarAnchorProvider({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      anchorAccount: keypair.publicKey(),
      anchorSecret: keypair.secret(),
    }, mock.client);

    await expect(provider.registerProof({
      proofId: 'PCA-TEST',
      contentHash: 'short',
      version: 1,
      timestamp: '2026-10-12T12:00:00Z',
    })).rejects.toThrow('SHA-256');

    await expect(provider.registerProof({
      proofId: 'bad/id$!',
      contentHash: digest,
      version: 1,
      timestamp: '2026-10-12T12:00:00Z',
    })).rejects.toThrow('proof ID');
  });

  it('estimates anchoring fee in XLM', async () => {
    const mock = horizonMock();
    const provider = new StellarAnchorProvider({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      anchorAccount: keypair.publicKey(),
      anchorSecret: keypair.secret(),
    }, mock.client);

    const cost = await provider.estimateCost();
    expect(cost.currency).toBe('XLM');
    expect(Number(cost.amount)).toBeGreaterThan(0);
  });
});
