export type AnchorStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
export interface RegisterProofInput {
    proofId: string;
    contentHash: string;
    metadataHash?: string;
    version: number;
    timestamp: string;
}
export interface AnchorReceipt {
    network: string;
    transactionHash: string;
    status: AnchorStatus;
    submittedAt: string;
    blockNumber?: bigint;
    anchoredAt?: string;
    providerReceipt?: Record<string, unknown>;
}
export interface BlockchainProvider {
    readonly network: string;
    registerProof(input: RegisterProofInput): Promise<AnchorReceipt>;
    getTransactionStatus(transactionHash: string): Promise<AnchorReceipt>;
    verifyProof(contentHash: string, transactionHash: string): Promise<boolean>;
    estimateCost(contentHash: string): Promise<{
        amount: string;
        currency: string;
    }>;
}
