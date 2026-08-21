import { z } from 'zod';
declare const environmentSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<{
        development: "development";
        test: "test";
        production: "production";
    }>>;
    HOST: z.ZodDefault<z.ZodString>;
    PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    DATABASE_URL: z.ZodString;
    APP_ORIGIN: z.ZodDefault<z.ZodString>;
    PUBLIC_API_URL: z.ZodDefault<z.ZodString>;
    SESSION_COOKIE_NAME: z.ZodDefault<z.ZodString>;
    SESSION_TTL_HOURS: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    PRIVACY_HASH_SECRET: z.ZodString;
    STORAGE_BUCKET: z.ZodString;
    STORAGE_REGION: z.ZodDefault<z.ZodString>;
    STORAGE_ENDPOINT: z.ZodOptional<z.ZodString>;
    STORAGE_ACCESS_KEY_ID: z.ZodOptional<z.ZodString>;
    STORAGE_SECRET_ACCESS_KEY: z.ZodOptional<z.ZodString>;
    STORAGE_KMS_KEY_ID: z.ZodOptional<z.ZodString>;
    MAX_UPLOAD_BYTES: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    ANCHOR_PROVIDER: z.ZodDefault<z.ZodEnum<{
        sandbox: "sandbox";
        http: "http";
    }>>;
    ANCHOR_NETWORK: z.ZodDefault<z.ZodString>;
    ANCHOR_API_URL: z.ZodOptional<z.ZodString>;
    ANCHOR_API_KEY: z.ZodOptional<z.ZodString>;
    ANCHOR_EXPLORER_URL: z.ZodOptional<z.ZodString>;
    MALWARE_SCANNER_URL: z.ZodOptional<z.ZodString>;
    MALWARE_SCANNER_TOKEN: z.ZodOptional<z.ZodString>;
    EMAIL_DELIVERY_URL: z.ZodOptional<z.ZodString>;
    EMAIL_DELIVERY_TOKEN: z.ZodOptional<z.ZodString>;
    GOOGLE_CLIENT_ID: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AppConfig = z.infer<typeof environmentSchema>;
export declare function loadConfig(environment?: NodeJS.ProcessEnv): AppConfig;
export {};
