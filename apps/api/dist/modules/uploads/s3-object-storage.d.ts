import type { AppConfig } from '../../config.js';
import type { CreateUploadInput, ObjectMetadata, ObjectStorage, SignedUpload } from './object-storage.js';
export declare class S3ObjectStorage implements ObjectStorage {
    private readonly config;
    private readonly client;
    constructor(config: AppConfig);
    private encryption;
    createSignedUpload(input: CreateUploadInput): Promise<SignedUpload>;
    createSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
    head(key: string): Promise<ObjectMetadata>;
    readHeader(key: string, bytes?: number): Promise<Uint8Array>;
    stream(key: string): Promise<AsyncIterable<Uint8Array>>;
    remove(key: string): Promise<void>;
}
