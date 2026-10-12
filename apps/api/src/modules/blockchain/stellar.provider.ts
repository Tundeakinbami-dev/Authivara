import { Horizon, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { AppError } from '../../shared/errors.js';
import type { AnchorReceipt, BlockchainProvider, RegisterProofInput } from './blockchain-provider.js';

const DATA_KEY_PREFIX = 'authivara-proof:';

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
    this.client = client ?? new Horizon.Server(options.horizonUrl) as unknown as StellarHorizonClient;
  }

  async registerProof(input: RegisterProofInput): Promise<AnchorReceipt> {
    if (!/^[a-f0-9]{64}$/i.test(input.contentHash)) throw new AppError('Stellar anchors require a SHA-256 hex digest', 400, 'INVALID_CONTENT_HASH');
    const account = await this.client.loadAccount(this.options.anchorAccount);
    const fee = await this.client.fetchBaseFee();
    const transaction = new TransactionBuilder(account as ConstructorParameters<typeof TransactionBuilder>[0], {
      fee: String(fee), networkPassphrase: this.options.networkPassphrase,
    })
      .addOperation(Operation.manageData({ name: `${DATA_KEY_PREFIX}${input.proofId}`, value: input.contentHash.toLowerCase() }))
      .setTimeout(60)
      .build();
    transaction.sign(this.signer);
    const submitted = await this.client.submitTransaction(transaction);
    return this.toReceipt(submitted, { dataKey: `${DATA_KEY_PREFIX}${input.proofId}`, digest: input.contentHash.toLowerCase() });
  }

  async getTransactionStatus(transactionHash: string): Promise<AnchorReceipt> {
    return this.toReceipt(await this.client.transactions().transaction(transactionHash).call());
  }

  async verifyProof(contentHash: string, transactionHash: string): Promise<boolean> {
    if (!/^[a-f0-9]{64}$/i.test(contentHash)) return false;
    const [transaction, operations] = await Promise.all([
      this.client.transactions().transaction(transactionHash).call(),
      this.client.operations().forTransaction(transactionHash).call(),
    ]);
    if (!transaction.successful) return false;
    return operations.records.some((operation) => operation.type === 'manage_data'
      && operation.name?.startsWith(DATA_KEY_PREFIX)
      && operation.value && Buffer.from(operation.value, 'base64').toString('utf8').toLowerCase() === contentHash.toLowerCase());
  }

  async estimateCost(): Promise<{ amount: string; currency: string }> {
    const stroops = await this.client.fetchBaseFee();
    return { amount: (stroops / 10_000_000).toFixed(7), currency: 'XLM' };
  }

  private toReceipt(transaction: HorizonTransaction, receipt?: Record<string, unknown>): AnchorReceipt {
    const confirmed = transaction.successful;
    return {
      network: this.network,
      transactionHash: transaction.hash,
      status: confirmed ? 'CONFIRMED' : 'FAILED',
      submittedAt: transaction.created_at,
      anchoredAt: confirmed ? transaction.created_at : undefined,
      blockNumber: transaction.ledger_attr ?? transaction.ledger ? BigInt(transaction.ledger_attr ?? transaction.ledger!) : undefined,
      providerReceipt: receipt,
    };
  }
}
