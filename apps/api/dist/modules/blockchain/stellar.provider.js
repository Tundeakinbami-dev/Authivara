import { Horizon, Keypair, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { AppError } from '../../shared/errors.js';
const DATA_KEY_PREFIX = 'authivara-proof:';
const SHA256_REGEX = /^[a-f0-9]{64}$/i;
const PROOF_ID_REGEX = /^[A-Za-z0-9_-]{3,32}$/;
/**
 * Anchors a content digest in a native Stellar `manageData` operation.
 * The data-entry value is the 64-character SHA-256 hex digest; no original
 * content, title, metadata, or identity data is submitted to Stellar.
 */
export class StellarAnchorProvider {
    options;
    kind = 'BLOCKCHAIN';
    network = 'Stellar Testnet';
    client;
    signer;
    constructor(options, client) {
        this.options = options;
        this.signer = Keypair.fromSecret(options.anchorSecret);
        if (this.signer.publicKey() !== options.anchorAccount) {
            throw new Error('STELLAR_ANCHOR_ACCOUNT does not match STELLAR_ANCHOR_SECRET');
        }
        this.client = client ?? new Horizon.Server(options.horizonUrl);
    }
    async registerProof(input) {
        if (!SHA256_REGEX.test(input.contentHash)) {
            throw new AppError('Stellar anchors require a valid 64-character SHA-256 hex digest', 400, 'INVALID_CONTENT_HASH');
        }
        if (!PROOF_ID_REGEX.test(input.proofId)) {
            throw new AppError('Invalid proof ID format for Stellar anchor operation', 400, 'INVALID_PROOF_ID');
        }
        try {
            const account = await this.client.loadAccount(this.options.anchorAccount);
            const fee = await this.client.fetchBaseFee();
            const dataKey = `${DATA_KEY_PREFIX}${input.proofId}`;
            const digest = input.contentHash.toLowerCase();
            const transaction = new TransactionBuilder(account, {
                fee: String(fee),
                networkPassphrase: this.options.networkPassphrase,
            })
                .addOperation(Operation.manageData({ name: dataKey, value: digest }))
                .setTimeout(60)
                .build();
            transaction.sign(this.signer);
            const submitted = await this.client.submitTransaction(transaction);
            return this.toReceipt(submitted, { dataKey, digest });
        }
        catch (error) {
            if (error instanceof AppError)
                throw error;
            const message = error instanceof Error ? error.message : 'Unknown Horizon error';
            throw new AppError(`Stellar transaction submission failed: ${message}`, 502, 'STELLAR_SUBMISSION_FAILED');
        }
    }
    async getTransactionStatus(transactionHash) {
        if (!SHA256_REGEX.test(transactionHash)) {
            return {
                network: this.network,
                transactionHash,
                status: 'FAILED',
                submittedAt: new Date().toISOString(),
            };
        }
        try {
            const tx = await this.client.transactions().transaction(transactionHash).call();
            return this.toReceipt(tx);
        }
        catch {
            return {
                network: this.network,
                transactionHash,
                status: 'FAILED',
                submittedAt: new Date().toISOString(),
            };
        }
    }
    async verifyProof(contentHash, transactionHash, proofId) {
        if (!SHA256_REGEX.test(contentHash))
            return false;
        if (!SHA256_REGEX.test(transactionHash))
            return false;
        try {
            const [transaction, operations] = await Promise.all([
                this.client.transactions().transaction(transactionHash).call(),
                this.client.operations().forTransaction(transactionHash).call(),
            ]);
            if (!transaction.successful)
                return false;
            const expectedKey = proofId ? `${DATA_KEY_PREFIX}${proofId}` : undefined;
            const normalizedDigest = contentHash.toLowerCase();
            return operations.records.some((operation) => {
                if (operation.type !== 'manage_data')
                    return false;
                if (!operation.name || !operation.value)
                    return false;
                const keyMatches = expectedKey
                    ? operation.name === expectedKey
                    : operation.name.startsWith(DATA_KEY_PREFIX);
                if (!keyMatches)
                    return false;
                const decodedValue = Buffer.from(operation.value, 'base64').toString('utf8').toLowerCase();
                return decodedValue === normalizedDigest;
            });
        }
        catch {
            return false;
        }
    }
    async estimateCost() {
        try {
            const stroops = await this.client.fetchBaseFee();
            return { amount: (stroops / 10_000_000).toFixed(7), currency: 'XLM' };
        }
        catch {
            return { amount: '0.0000100', currency: 'XLM' };
        }
    }
    toReceipt(transaction, receipt) {
        const confirmed = transaction.successful;
        const ledgerNumber = transaction.ledger_attr ?? transaction.ledger;
        return {
            network: this.network,
            transactionHash: transaction.hash,
            status: confirmed ? 'CONFIRMED' : 'FAILED',
            submittedAt: transaction.created_at,
            anchoredAt: confirmed ? transaction.created_at : undefined,
            blockNumber: ledgerNumber ? BigInt(ledgerNumber) : undefined,
            providerReceipt: receipt,
        };
    }
}
