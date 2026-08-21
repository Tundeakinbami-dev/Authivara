import { describe, expect, it } from 'vitest';
import { validateFileDeclaration, validateFileSignature } from '../src/modules/uploads/file-policy.js';

describe('upload file policy', () => {
  it('accepts matching extension, MIME type, and actual PNG signature', () => {
    const input = { fileName: 'art.png', mimeType: 'image/png', fileSize: 128 };
    const type = validateFileSignature(input, Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 1024);
    expect(type.category).toBe('IMAGE');
  });

  it('rejects a renamed executable that declares itself as a PNG', () => {
    const input = { fileName: 'unsafe.png', mimeType: 'image/png', fileSize: 128 };
    expect(() => validateFileSignature(input, new TextEncoder().encode('MZ executable'), 1024)).toThrow('signature');
  });

  it('rejects an extension and MIME mismatch before issuing a signed URL', () => {
    expect(() => validateFileDeclaration({ fileName: 'track.mp3', mimeType: 'application/pdf', fileSize: 128 }, 1024)).toThrow('not an allowed combination');
  });

  it('enforces the configured maximum size', () => {
    expect(() => validateFileDeclaration({ fileName: 'art.png', mimeType: 'image/png', fileSize: 1025 }, 1024)).toThrow('File size');
  });
});
