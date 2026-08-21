import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateCertificatePdf } from '../src/modules/certificates/pdf-certificate.js';

describe('PDF provenance certificate', () => {
  it('creates a professional one-page PDF with a verification QR code', async () => {
    const bytes = await generateCertificatePdf({
      creator: 'Amina Okafor',
      workTitle: 'Lagos Sunset',
      proofId: 'PCA-ABCDEF123456',
      contentHash: 'a'.repeat(64),
      registeredAt: new Date('2026-08-21T12:00:00.000Z'),
      blockchainNetwork: 'Base Mainnet',
      transactionId: `0x${'b'.repeat(64)}`,
      verificationUrl: 'https://authivara.example/proof/PCA-ABCDEF123456',
      certificateNumber: 'AV-2026-ABCDEF123456',
      issuedAt: new Date('2026-08-21T12:10:00.000Z'),
    });

    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe('%PDF');
    expect(bytes.byteLength).toBeGreaterThan(5_000);
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getTitle()).toContain('AV-2026-ABCDEF123456');
  });
});
