import { seedWorks } from './data';
import type { ProofWork } from './types';

const STORAGE_KEY = 'authivara.proofs.v1';

export function loadWorks(): ProofWork[] {
  if (typeof window === 'undefined') return seedWorks;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ProofWork[]) : seedWorks;
  } catch {
    return seedWorks;
  }
}

export function saveWorks(works: ProofWork[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(works));
}
