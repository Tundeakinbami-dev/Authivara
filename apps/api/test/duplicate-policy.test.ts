import { describe, expect, it } from 'vitest';
import { classifyDuplicate, type DuplicateMatch } from '../src/modules/uploads/duplicate-policy.js';

const match = (overrides: Partial<DuplicateMatch>): DuplicateMatch => ({
  id: 'content-1', ownerId: 'other-user', organizationId: null, title: 'Private title', visibility: 'PRIVATE', provenance: [{ proofId: 'PCA-ABCDEF123456' }], ...overrides,
});

describe('privacy-safe duplicate classification', () => {
  it('returns owner and authorized organization matches', () => {
    expect(classifyDuplicate([match({ ownerId: 'me' })], 'me', []).type).toBe('SAME_USER');
    expect(classifyDuplicate([match({ organizationId: 'org-1' })], 'me', ['org-1']).type).toBe('SAME_ORGANIZATION');
  });

  it('returns only public proof information for another account', () => {
    const result = classifyDuplicate([match({ visibility: 'PUBLIC', title: 'Public work' })], 'me', []);
    expect(result).toMatchObject({ type: 'PUBLIC', proofId: 'PCA-ABCDEF123456', title: 'Public work' });
    expect(result).not.toHaveProperty('ownerId');
  });

  it('makes another account private match indistinguishable from no match', () => {
    const privateResult = classifyDuplicate([match({})], 'me', []);
    const noResult = classifyDuplicate([], 'me', []);
    expect(privateResult).toEqual(noResult);
    expect(JSON.stringify(privateResult)).not.toContain('Private title');
  });
});
