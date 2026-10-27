import type { AnchorReceipt, BlockchainProvider, RegisterProofInput } from './blockchain-provider.js';
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
    transactions(): {
        transaction(hash: string): {
            call(): Promise<HorizonTransaction>;
        };
    };
    operations(): {
        forTransaction(hash: string): {
            call(): Promise<{
                records: HorizonOperation[];
            }>;
        };
    };
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
export declare class StellarAnchorProvider implements BlockchainProvider {
    private readonly options;
    readonly kind: "BLOCKCHAIN";
    readonly network = "Stellar Testnet";
    private readonly client;
    private readonly signer;
    constructor(options: StellarAnchorOptions, client?: StellarHorizonClient);
    registerProof(input: RegisterProofInput): Promise<AnchorReceipt>;
    getTransactionStatus(transactionHash: string): Promise<AnchorReceipt>;
    verifyProof(contentHash: string, transactionHash: string, proofId?: string): Promise<boolean>;
    estimateCost(): Promise<{
        amount: string;
        currency: string;
    }>;
    private toReceipt;
}
export {};
