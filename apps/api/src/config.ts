import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  APP_ORIGIN: z.string().url().default('http://localhost:4173'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  SESSION_COOKIE_NAME: z.string().default('authivara_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  PRIVACY_HASH_SECRET: z.string().min(32),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_KMS_KEY_ID: z.string().optional(),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(2_147_483_648),
  ANCHOR_PROVIDER: z.enum(['sandbox', 'http', 'stellar']).default('sandbox'),
  ANCHOR_NETWORK: z.string().default('Authivara Sandbox Anchor'),
  ANCHOR_API_URL: z.string().url().optional(),
  ANCHOR_API_KEY: z.string().optional(),
  ANCHOR_EXPLORER_URL: z.string().url().optional(),
  STELLAR_HORIZON_URL: z.string().url().default('https://horizon-testnet.stellar.org'),
  STELLAR_NETWORK_PASSPHRASE: z.string().default('Test SDF Network ; September 2015'),
  STELLAR_ANCHOR_ACCOUNT: z.string().regex(/^G[A-Z2-7]{55}$/, 'STELLAR_ANCHOR_ACCOUNT must be a Stellar public key').optional(),
  STELLAR_ANCHOR_SECRET: z.string().regex(/^S[A-Z2-7]{55}$/, 'STELLAR_ANCHOR_SECRET must be a Stellar secret seed').optional(),
  MALWARE_SCANNER_URL: z.string().url().optional(),
  MALWARE_SCANNER_TOKEN: z.string().optional(),
  EMAIL_DELIVERY_URL: z.string().url().optional(),
  EMAIL_DELIVERY_TOKEN: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(`Invalid API configuration: ${z.prettifyError(parsed.error)}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.ANCHOR_PROVIDER === 'sandbox') {
    throw new Error('ANCHOR_PROVIDER=sandbox is forbidden in production');
  }
  if (parsed.data.NODE_ENV === 'production' && !parsed.data.SESSION_COOKIE_NAME.startsWith('__Host-')) {
    throw new Error('Production SESSION_COOKIE_NAME must use the __Host- prefix');
  }
  if (parsed.data.ANCHOR_PROVIDER === 'http' && (!parsed.data.ANCHOR_API_URL || !parsed.data.ANCHOR_API_KEY)) {
    throw new Error('ANCHOR_API_URL and ANCHOR_API_KEY are required for the http anchoring provider');
  }
  if (parsed.data.ANCHOR_PROVIDER === 'stellar') {
    if (!parsed.data.STELLAR_ANCHOR_ACCOUNT || !parsed.data.STELLAR_ANCHOR_SECRET) {
      throw new Error('STELLAR_ANCHOR_ACCOUNT and STELLAR_ANCHOR_SECRET are required for the stellar anchoring provider');
    }
    if (!parsed.data.ANCHOR_EXPLORER_URL) {
      parsed.data.ANCHOR_EXPLORER_URL = 'https://stellar.expert/explorer/testnet/tx';
    }
  }
  if (parsed.data.NODE_ENV === 'production' && !parsed.data.MALWARE_SCANNER_URL) {
    throw new Error('MALWARE_SCANNER_URL is required in production');
  }
  if (parsed.data.NODE_ENV === 'production' && !parsed.data.EMAIL_DELIVERY_URL) {
    throw new Error('EMAIL_DELIVERY_URL is required in production');
  }
  return parsed.data;
}
