import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/authivara',
  APP_ORIGIN: 'https://app.example.com',
  PUBLIC_API_URL: 'https://api.example.com',
  PRIVACY_HASH_SECRET: 'a-secret-with-at-least-thirty-two-characters',
  STORAGE_BUCKET: 'private-content',
};

describe('production safety gates', () => {
  it('rejects the sandbox blockchain provider in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', ANCHOR_PROVIDER: 'sandbox' })).toThrow('sandbox is forbidden');
  });

  it('requires a __Host- session cookie in production', () => {
    expect(() => loadConfig({
      ...base,
      NODE_ENV: 'production',
      ANCHOR_PROVIDER: 'http', ANCHOR_API_URL: 'https://anchor.example.com', ANCHOR_API_KEY: 'secret',
      SESSION_COOKIE_NAME: 'unsafe', MALWARE_SCANNER_URL: 'https://scanner.example.com', EMAIL_DELIVERY_URL: 'https://email.example.com',
    })).toThrow('__Host-');
  });

  it('requires a Stellar account and seed when the Stellar provider is selected', () => {
    expect(() => loadConfig({ ...base, ANCHOR_PROVIDER: 'stellar' })).toThrow('STELLAR_ANCHOR_ACCOUNT');
  });
});
