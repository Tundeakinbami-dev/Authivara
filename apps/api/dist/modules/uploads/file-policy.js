import { AppError } from '../../shared/errors.js';
const startsWith = (header, bytes) => bytes.every((value, index) => header[index] === value);
const ascii = (header, start, text) => text.split('').every((char, index) => header[start + index] === char.charCodeAt(0));
const zip = (header) => startsWith(header, [0x50, 0x4b, 0x03, 0x04]) || startsWith(header, [0x50, 0x4b, 0x05, 0x06]);
export const allowedFileTypes = [
    { category: 'IMAGE', extensions: ['jpg', 'jpeg'], mimeTypes: ['image/jpeg'], matchesSignature: (h) => startsWith(h, [0xff, 0xd8, 0xff]) },
    { category: 'IMAGE', extensions: ['png'], mimeTypes: ['image/png'], matchesSignature: (h) => startsWith(h, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
    { category: 'IMAGE', extensions: ['webp'], mimeTypes: ['image/webp'], matchesSignature: (h) => ascii(h, 0, 'RIFF') && ascii(h, 8, 'WEBP') },
    { category: 'DOCUMENT', extensions: ['pdf'], mimeTypes: ['application/pdf'], matchesSignature: (h) => ascii(h, 0, '%PDF-') },
    { category: 'VIDEO', extensions: ['mp4'], mimeTypes: ['video/mp4'], matchesSignature: (h) => ascii(h, 4, 'ftyp') },
    { category: 'VIDEO', extensions: ['mov'], mimeTypes: ['video/quicktime'], matchesSignature: (h) => ascii(h, 4, 'ftyp') },
    { category: 'AUDIO', extensions: ['mp3'], mimeTypes: ['audio/mpeg'], matchesSignature: (h) => ascii(h, 0, 'ID3') || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0) },
    { category: 'AUDIO', extensions: ['wav'], mimeTypes: ['audio/wav', 'audio/x-wav'], matchesSignature: (h) => ascii(h, 0, 'RIFF') && ascii(h, 8, 'WAVE') },
    { category: 'DOCUMENT', extensions: ['docx'], mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], matchesSignature: zip },
    { category: 'DOCUMENT', extensions: ['txt'], mimeTypes: ['text/plain'], matchesSignature: (h) => !h.includes(0) },
    { category: 'ARCHIVE', extensions: ['zip'], mimeTypes: ['application/zip', 'application/x-zip-compressed'], matchesSignature: zip },
    { category: 'DESIGN', extensions: ['psd'], mimeTypes: ['image/vnd.adobe.photoshop', 'application/octet-stream'], matchesSignature: (h) => ascii(h, 0, '8BPS') },
    { category: 'DESIGN', extensions: ['ai'], mimeTypes: ['application/pdf', 'application/postscript'], matchesSignature: (h) => ascii(h, 0, '%PDF-') || ascii(h, 0, '%!PS-Adobe') },
    { category: 'DESIGN', extensions: ['fig'], mimeTypes: ['application/zip', 'application/octet-stream'], matchesSignature: zip },
];
function extensionOf(fileName) {
    const dot = fileName.lastIndexOf('.');
    return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}
export function validateFileDeclaration(input, maxBytes) {
    if (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0 || input.fileSize > maxBytes) {
        throw new AppError(`File size must be between 1 and ${maxBytes} bytes`, 400, 'INVALID_FILE_SIZE');
    }
    const extension = extensionOf(input.fileName);
    const type = allowedFileTypes.find((candidate) => candidate.extensions.includes(extension) && candidate.mimeTypes.includes(input.mimeType.toLowerCase()));
    if (!type)
        throw new AppError('File extension and declared MIME type are not an allowed combination', 415, 'UNSUPPORTED_FILE_TYPE');
    return type;
}
export function validateFileSignature(input, header, maxBytes) {
    const type = validateFileDeclaration(input, maxBytes);
    if (!type.matchesSignature(header)) {
        throw new AppError('File signature does not match the declared type', 415, 'FILE_SIGNATURE_MISMATCH');
    }
    return type;
}
