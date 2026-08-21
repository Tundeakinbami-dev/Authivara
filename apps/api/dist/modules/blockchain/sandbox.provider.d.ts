import type { AnchorReceipt, BlockchainProvider, RegisterProofInput } from './blockchain-provider.js';
/** Development-only deterministic provider. Production startup rejects this provider. */
export declare class SandboxBlockchainProvider implements BlockchainProvider {
    readonly network = "Authivara Sandbox Anchor";
    registerProof(input: RegisterProofInput): Promise<AnchorReceipt>;
    getTransactionStatus(transactionHash: string): Promise<AnchorReceipt>;
    verifyProof(contentHash: string, transactionHash: string): Promise<boolean>;
    estimateCost(): Promise<{
        amount: string;
        currency: string;
    }>;
}
