import { sha256 } from '../../shared/crypto.js';
/** Development-only deterministic provider. Production startup rejects this provider. */
export class SandboxBlockchainProvider {
    kind = 'BLOCKCHAIN';
    network = 'Authivara Sandbox Anchor';
    async registerProof(input) {
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
    async getTransactionStatus(transactionHash) {
        return { network: this.network, transactionHash, status: 'CONFIRMED', submittedAt: new Date().toISOString(), blockNumber: 0n };
    }
    async verifyProof(contentHash, transactionHash) {
        return Boolean(contentHash && transactionHash.startsWith('sandbox_'));
    }
    async estimateCost() {
        return { amount: '0', currency: 'SANDBOX' };
    }
}
