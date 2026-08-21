import { describe, expect, it } from 'vitest';
import { createAnchor, formatBytes, shortenHash } from './crypto';

describe('proof utilities', () => {
  it('shortens a digest without obscuring both ends', () => {
    expect(shortenHash('1234567890abcdef', 4, 4)).toBe('1234…cdef');
  });

  it('uses readable binary file sizes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('creates a deterministic sandbox anchor', () => {
    const hash = 'a'.repeat(64);
    expect(createAnchor(hash)).toBe(`0x${'a'.repeat(64)}`);
  });
});
