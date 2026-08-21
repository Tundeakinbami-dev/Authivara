import { describe, expect, it } from 'vitest';
import { canonicalJson, privacyHash, randomProofId, sha256 } from '../src/shared/crypto.js';

describe('evidence cryptography helpers', () => {
  it('canonicalizes object keys before hashing metadata', () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
    expect(sha256(canonicalJson({ b: 2, a: 1 }))).toBe(sha256(canonicalJson({ a: 1, b: 2 })));
  });

  it('anonymizes network identifiers with a keyed digest', () => {
    const secret = 'a-secure-secret-with-more-than-32-characters';
    expect(privacyHash('203.0.113.8', secret)).toHaveLength(64);
    expect(privacyHash('203.0.113.8', secret)).not.toContain('203.0.113.8');
  });

  it('hashes exact bytes with the standard SHA-256 result', () => {
    expect(sha256(Buffer.from('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('creates non-sequential public proof identifiers', () => {
    const first = randomProofId();
    expect(first).toMatch(/^PCA-[A-F0-9]{12}$/);
    expect(randomProofId()).not.toBe(first);
  });
});
