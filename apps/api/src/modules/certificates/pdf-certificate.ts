import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';

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

const teal = rgb(0.075, 0.29, 0.27);
const sea = rgb(0.13, 0.48, 0.43);
const gold = rgb(0.75, 0.55, 0.25);
const ink = rgb(0.12, 0.22, 0.22);
const muted = rgb(0.39, 0.49, 0.48);
const paper = rgb(0.975, 0.982, 0.972);

export async function generateCertificatePdf(data: PdfCertificateData): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`Authivara provenance certificate ${data.certificateNumber}`);
  document.setAuthor('Authivara');
  document.setSubject('Cryptographic evidence of file existence and provenance');
  document.setKeywords(['provenance', 'SHA-256', 'content verification']);
  document.setCreationDate(data.issuedAt);
  const page = document.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();
  const sans = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const serif = await document.embedFont(StandardFonts.TimesRomanBold);
  const mono = await document.embedFont(StandardFonts.Courier);

  page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: teal, borderWidth: 1.2 });
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: gold, borderWidth: 0.45 });
  page.drawRectangle({ x: 0, y: height - 18, width, height: 18, color: teal });
  page.drawRectangle({ x: 52, y: 500, width: 5, height: 42, color: gold });

  page.drawText('A U T H I V A R A', { x: 70, y: 526, size: 12, font: bold, color: teal });
  page.drawText('CRYPTOGRAPHIC  PROVENANCE  RECORD', { x: 70, y: 508, size: 7.5, font: sans, color: muted });
  page.drawText('Certificate of Content Provenance', { x: 52, y: 450, size: 31, font: serif, color: ink });
  page.drawText('Independent evidence that an exact SHA-256 fingerprint was registered at the stated time.', { x: 54, y: 426, size: 10, font: sans, color: muted });

  drawLabel(page, bold, 'CREATOR', 54, 382);
  drawValue(page, sans, data.creator, 54, 361, 250);
  drawLabel(page, bold, 'WORK TITLE', 324, 382);
  drawValue(page, sans, data.workTitle, 324, 361, 305);
  drawLabel(page, bold, 'PROOF ID', 54, 322);
  drawValue(page, mono, data.proofId, 54, 302, 250);
  drawLabel(page, bold, 'REGISTERED', 324, 322);
  drawValue(page, sans, formatDate(data.registeredAt), 324, 302, 305);

  page.drawLine({ start: { x: 54, y: 278 }, end: { x: 628, y: 278 }, thickness: 0.6, color: rgb(0.83, 0.87, 0.85) });
  drawLabel(page, bold, 'CANONICAL CONTENT FINGERPRINT · SHA-256 OF EXACT FILE BYTES', 54, 252);
  page.drawText(data.contentHash, { x: 54, y: 231, size: 8.4, font: mono, color: teal, maxWidth: 574 });

  drawLabel(page, bold, 'ANCHORING NETWORK', 54, 193);
  drawValue(page, sans, data.blockchainNetwork, 54, 173, 250);
  drawLabel(page, bold, 'TRANSACTION ID', 324, 193);
  page.drawText(data.transactionId ?? 'Pending confirmation', { x: 324, y: 173, size: 7.5, font: mono, color: ink, maxWidth: 304 });

  page.drawRectangle({ x: 653, y: 171, width: 135, height: 211, color: rgb(0.93, 0.96, 0.945), borderColor: rgb(0.78, 0.86, 0.83), borderWidth: 0.7 });
  const qrDataUrl = await QRCode.toDataURL(data.verificationUrl, { errorCorrectionLevel: 'M', margin: 1, width: 360, color: { dark: '#133f3b', light: '#edf5f1' } });
  const qr = await document.embedPng(Buffer.from(qrDataUrl.split(',')[1]!, 'base64'));
  page.drawImage(qr, { x: 666, y: 230, width: 109, height: 109 });
  page.drawText('SCAN TO VERIFY', { x: 676, y: 210, size: 8, font: bold, color: teal });
  page.drawText(data.proofId, { x: 669, y: 191, size: 6.7, font: mono, color: muted, maxWidth: 104 });

  page.drawRectangle({ x: 52, y: 72, width: 736, height: 67, color: rgb(0.94, 0.95, 0.92) });
  page.drawText('EVIDENTIARY NOTICE', { x: 66, y: 116, size: 7.5, font: bold, color: rgb(0.43, 0.34, 0.18) });
  page.drawText('This document records cryptographic evidence of file existence and account submission. It is not an official government copyright certificate,', { x: 66, y: 99, size: 7.3, font: sans, color: muted });
  page.drawText('does not adjudicate authorship or ownership, and does not replace registration with any government authority.', { x: 66, y: 87, size: 7.3, font: sans, color: muted });

  page.drawText(`Certificate ${data.certificateNumber}`, { x: 52, y: 45, size: 7, font: mono, color: muted });
  page.drawText(`Issued ${formatDate(data.issuedAt)}`, { x: 344, y: 45, size: 7, font: sans, color: muted });
  page.drawText('Verify: ' + truncate(data.verificationUrl, 72), { x: 500, y: 45, size: 6.2, font: sans, color: sea, maxWidth: 287 });
  return document.save();
}

function drawLabel(page: PDFPage, font: PDFFont, text: string, x: number, y: number) {
  page.drawText(text, { x, y, size: 7.2, font, color: muted });
}

function drawValue(page: PDFPage, font: PDFFont, text: string, x: number, y: number, maxWidth: number) {
  page.drawText(truncate(text, 52), { x, y, size: 11.5, font, color: ink, maxWidth });
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }).format(value) + ' UTC';
}

function truncate(value: string, maximum: number): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}
