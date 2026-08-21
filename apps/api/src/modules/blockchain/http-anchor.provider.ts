import { AppError } from '../../shared/errors.js';
import type { AnchorReceipt, BlockchainProvider, RegisterProofInput } from './blockchain-provider.js';

interface RemoteReceipt {
  transactionHash: string;
  status: AnchorReceipt['status'];
  submittedAt: string;
  blockNumber?: string;
  anchoredAt?: string;
  receipt?: Record<string, unknown>;
}

/** Adapter for a managed EVM/Merkle anchoring gateway; original bytes are never sent. */
export class HttpAnchorProvider implements BlockchainProvider {
  readonly kind = 'BLOCKCHAIN' as const;
  constructor(
    readonly network: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new AppError('Anchoring provider request failed', 502, 'ANCHOR_PROVIDER_ERROR');
    return response.json() as Promise<T>;
  }

  async registerProof(input: RegisterProofInput): Promise<AnchorReceipt> {
    const remote = await this.request<RemoteReceipt>('/v1/proofs', { method: 'POST', body: JSON.stringify(input) });
    return this.toReceipt(remote);
  }

  async getTransactionStatus(transactionHash: string): Promise<AnchorReceipt> {
    return this.toReceipt(await this.request<RemoteReceipt>(`/v1/transactions/${encodeURIComponent(transactionHash)}`));
  }

  async verifyProof(contentHash: string, transactionHash: string): Promise<boolean> {
    const result = await this.request<{ valid: boolean }>('/v1/verify', { method: 'POST', body: JSON.stringify({ contentHash, transactionHash }) });
    return result.valid;
  }

  async estimateCost(contentHash: string): Promise<{ amount: string; currency: string }> {
    return this.request('/v1/cost', { method: 'POST', body: JSON.stringify({ contentHash }) });
  }

  private toReceipt(remote: RemoteReceipt): AnchorReceipt {
    return {
      network: this.network,
      transactionHash: remote.transactionHash,
      status: remote.status,
      submittedAt: remote.submittedAt,
      blockNumber: remote.blockNumber ? BigInt(remote.blockNumber) : undefined,
      anchoredAt: remote.anchoredAt,
      providerReceipt: remote.receipt,
    };
  }
}
