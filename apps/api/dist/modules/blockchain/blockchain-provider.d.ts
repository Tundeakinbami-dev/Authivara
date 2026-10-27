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
/** Standards-neutral provider contract. Implementations may anchor with a
 * blockchain, Content Credentials, trusted timestamping, or enterprise
 * notarization without coupling domain services to one ecosystem. */
export interface ProvenanceProvider {
    readonly kind: string;
    readonly network: string;
    registerProof(input: RegisterProofInput): Promise<AnchorReceipt>;
    getTransactionStatus(transactionHash: string): Promise<AnchorReceipt>;
    verifyProof(contentHash: string, transactionHash: string, proofId?: string): Promise<boolean>;
    estimateCost(contentHash: string): Promise<{
        amount: string;
        currency: string;
    }>;
}
export interface BlockchainProvider extends ProvenanceProvider {
    readonly kind: 'BLOCKCHAIN';
}
