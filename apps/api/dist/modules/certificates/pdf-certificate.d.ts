export interface PdfCertificateData {
    creator: string;
    workTitle: string;
    proofId: string;
    contentHash: string;
    registeredAt: Date;
    blockchainNetwork: string;
    transactionId: string | null;
    verificationUrl: string;
    certificateNumber: string;
    issuedAt: Date;
}
export declare function generateCertificatePdf(data: PdfCertificateData): Promise<Uint8Array>;
