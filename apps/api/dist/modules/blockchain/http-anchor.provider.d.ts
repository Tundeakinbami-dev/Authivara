import type { AnchorReceipt, BlockchainProvider, RegisterProofInput } from './blockchain-provider.js';
/** Adapter for a managed EVM/Merkle anchoring gateway; original bytes are never sent. */
export declare class HttpAnchorProvider implements BlockchainProvider {
    readonly network: string;
    private readonly baseUrl;
    private readonly apiKey;
    constructor(network: string, baseUrl: string, apiKey: string);
    private request;
    registerProof(input: RegisterProofInput): Promise<AnchorReceipt>;
    getTransactionStatus(transactionHash: string): Promise<AnchorReceipt>;
    verifyProof(contentHash: string, transactionHash: string): Promise<boolean>;
    estimateCost(contentHash: string): Promise<{
        amount: string;
        currency: string;
    }>;
    private toReceipt;
}
