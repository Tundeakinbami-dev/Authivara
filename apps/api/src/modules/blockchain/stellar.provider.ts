import { Horizon, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { AppError } from '../../shared/errors.js';
import type { AnchorReceipt, BlockchainProvider, RegisterProofInput } from './blockchain-provider.js';

const DATA_KEY_PREFIX = 'authivara-proof:';
const SHA256_REGEX = /^[a-f0-9]{64}$/i;
const PROOF_ID_REGEX = /^[A-Za-z0-9_-]{3,32}$/;

interface HorizonTransaction {
  hash: string;
  successful: boolean;
  created_at: string;
  ledger_attr?: number;
  ledger?: number;
}

interface HorizonOperation {
  type: string;
  name?: string;
  value?: string;
}

interface StellarHorizonClient {
  loadAccount(accountId: string): Promise<unknown>;
  fetchBaseFee(): Promise<number>;
  submitTransaction(transaction: unknown): Promise<HorizonTransaction>;
  transactions(): { transaction(hash: string): { call(): Promise<HorizonTransaction> } };
  operations(): { forTransaction(hash: string): { call(): Promise<{ records: HorizonOperation[] }> } };
}

export interface StellarAnchorOptions {
  horizonUrl: string;
  networkPassphrase: string;
  anchorAccount: string;
  anchorSecret: string;
}

/**
 * Anchors a content digest in a native Stellar `manageData` operation.
 * The data-entry value is the 64-character SHA-256 hex digest; no original
 * content, title, metadata, or identity data is submitted to Stellar.
 */
export class StellarAnchorProvider implements BlockchainProvider {
  readonly kind = 'BLOCKCHAIN' as const;
  readonly network = 'Stellar Testnet';
  private readonly client: StellarHorizonClient;
  private readonly signer: Keypair;

  constructor(private readonly options: StellarAnchorOptions, client?: StellarHorizonClient) {
    this.signer = Keypair.fromSecret(options.anchorSecret);
    if (this.signer.publicKey() !== options.anchorAccount) {
      throw new Error('STELLAR_ANCHOR_ACCOUNT does not match STELLAR_ANCHOR_SECRET');
    }
    this.client = client ?? (new Horizon.Server(options.horizonUrl) as unknown as StellarHorizonClient);
  }

  async registerProof(input: RegisterProofInput): Promise<AnchorReceipt> {
    if (!SHA256_REGEX.test(input.contentHash)) {
      throw new AppError('Stellar anchors require a valid 64-character SHA-256 hex digest', 400, 'INVALID_CONTENT_HASH');
    }
    if (!PROOF_ID_REGEX.test(input.proofId)) {
      throw new AppError('Invalid proof ID format for Stellar anchor operation', 400, 'INVALID_PROOF_ID');
    }

    try {
      const account = await this.client.loadAccount(this.options.anchorAccount);
      const fee = await this.client.fetchBaseFee();
      const dataKey = `${DATA_KEY_PREFIX}${input.proofId}`;
      const digest = input.contentHash.toLowerCase();

      const transaction = new TransactionBuilder(account as ConstructorParameters<typeof TransactionBuilder>[0], {
        fee: String(fee),
        networkPassphrase: this.options.networkPassphrase,
      })
        .addOperation(Operation.manageData({ name: dataKey, value: digest }))
        .setTimeout(60)
        .build();

      transaction.sign(this.signer);
      const submitted = await this.client.submitTransaction(transaction);
      return this.toReceipt(submitted, { dataKey, digest });
    } catch (error) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown Horizon error';
      throw new AppError(`Stellar transaction submission failed: ${message}`, 502, 'STELLAR_SUBMISSION_FAILED');
    }
  }

  async getTransactionStatus(transactionHash: string): Promise<AnchorReceipt> {
    if (!SHA256_REGEX.test(transactionHash)) {
      return {
        network: this.network,
        transactionHash,
        status: 'FAILED',
        submittedAt: new Date().toISOString(),
      };
    }

    try {
      const tx = await this.client.transactions().transaction(transactionHash).call();
      return this.toReceipt(tx);
    } catch {
      return {
        network: this.network,
        transactionHash,
        status: 'FAILED',
        submittedAt: new Date().toISOString(),
      };
    }
  }

  async verifyProof(contentHash: string, transactionHash: string, proofId?: string): Promise<boolean> {
    if (!SHA256_REGEX.test(contentHash)) return false;
    if (!SHA256_REGEX.test(transactionHash)) return false;

    try {
      const [transaction, operations] = await Promise.all([
        this.client.transactions().transaction(transactionHash).call(),
        this.client.operations().forTransaction(transactionHash).call(),
      ]);

      if (!transaction.successful) return false;

      const expectedKey = proofId ? `${DATA_KEY_PREFIX}${proofId}` : undefined;
      const normalizedDigest = contentHash.toLowerCase();

      return operations.records.some((operation) => {
        if (operation.type !== 'manage_data') return false;
        if (!operation.name || !operation.value) return false;

        const keyMatches = expectedKey
          ? operation.name === expectedKey
          : operation.name.startsWith(DATA_KEY_PREFIX);
        if (!keyMatches) return false;

        const decodedValue = Buffer.from(operation.value, 'base64').toString('utf8').toLowerCase();
        return decodedValue === normalizedDigest;
      });
    } catch {
      return false;
    }
  }

  async estimateCost(): Promise<{ amount: string; currency: string }> {
    try {
      const stroops = await this.client.fetchBaseFee();
      return { amount: (stroops / 10_000_000).toFixed(7), currency: 'XLM' };
    } catch {
      return { amount: '0.0000100', currency: 'XLM' };
    }
  }

  private toReceipt(transaction: HorizonTransaction, receipt?: Record<string, unknown>): AnchorReceipt {
    const confirmed = transaction.successful;
    const ledgerNumber = transaction.ledger_attr ?? transaction.ledger;
    return {
      network: this.network,
      transactionHash: transaction.hash,
      status: confirmed ? 'CONFIRMED' : 'FAILED',
      submittedAt: transaction.created_at,
      anchoredAt: confirmed ? transaction.created_at : undefined,
      blockNumber: ledgerNumber ? BigInt(ledgerNumber) : undefined,
      providerReceipt: receipt,
    };
  }
}
