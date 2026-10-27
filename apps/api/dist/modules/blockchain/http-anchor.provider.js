import { AppError } from '../../shared/errors.js';
/** Adapter for a managed EVM/Merkle anchoring gateway; original bytes are never sent. */
export class HttpAnchorProvider {
    network;
    baseUrl;
    apiKey;
    kind = 'BLOCKCHAIN';
    constructor(network, baseUrl, apiKey) {
        this.network = network;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }
    async request(path, init) {
        const response = await fetch(new URL(path, this.baseUrl), {
            ...init,
            headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json', ...init?.headers },
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok)
            throw new AppError('Anchoring provider request failed', 502, 'ANCHOR_PROVIDER_ERROR');
        return response.json();
    }
    async registerProof(input) {
        const remote = await this.request('/v1/proofs', { method: 'POST', body: JSON.stringify(input) });
        return this.toReceipt(remote);
    }
    async getTransactionStatus(transactionHash) {
        return this.toReceipt(await this.request(`/v1/transactions/${encodeURIComponent(transactionHash)}`));
    }
    async verifyProof(contentHash, transactionHash) {
        const result = await this.request('/v1/verify', { method: 'POST', body: JSON.stringify({ contentHash, transactionHash }) });
        return result.valid;
    }
    async estimateCost(contentHash) {
        return this.request('/v1/cost', { method: 'POST', body: JSON.stringify({ contentHash }) });
    }
    toReceipt(remote) {
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
