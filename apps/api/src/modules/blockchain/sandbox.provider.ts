import { sha256 } from '../../shared/crypto.js';
import type { AnchorReceipt, BlockchainProvider, RegisterProofInput } from './blockchain-provider.js';

/** Development-only deterministic provider. Production startup rejects this provider. */
export class SandboxBlockchainProvider implements BlockchainProvider {
  readonly kind = 'BLOCKCHAIN' as const;
  readonly network = 'Authivara Sandbox Anchor';

  async registerProof(input: RegisterProofInput): Promise<AnchorReceipt> {
    return {
      network: this.network,
      transactionHash: `sandbox_${sha256(`${input.proofId}:${input.contentHash}:${input.timestamp}`)}`,
      status: 'CONFIRMED',
      submittedAt: input.timestamp,
      anchoredAt: input.timestamp,
      blockNumber: 0n,
      providerReceipt: { sandbox: true, contentHash: input.contentHash },
    };
  }

  async getTransactionStatus(transactionHash: string): Promise<AnchorReceipt> {
    return { network: this.network, transactionHash, status: 'CONFIRMED', submittedAt: new Date().toISOString(), blockNumber: 0n };
  }

  async verifyProof(contentHash: string, transactionHash: string): Promise<boolean> {
    return Boolean(contentHash && transactionHash.startsWith('sandbox_'));
  }

  async estimateCost(): Promise<{ amount: string; currency: string }> {
    return { amount: '0', currency: 'SANDBOX' };
  }
}
