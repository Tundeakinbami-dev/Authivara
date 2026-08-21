import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppConfig } from '../../config.js';
import type { CreateUploadInput, ObjectMetadata, ObjectStorage, SignedUpload } from './object-storage.js';

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: AppConfig) {
    const explicitCredentials = config.STORAGE_ACCESS_KEY_ID && config.STORAGE_SECRET_ACCESS_KEY
      ? { accessKeyId: config.STORAGE_ACCESS_KEY_ID, secretAccessKey: config.STORAGE_SECRET_ACCESS_KEY }
      : undefined;
    this.client = new S3Client({
      region: config.STORAGE_REGION,
      endpoint: config.STORAGE_ENDPOINT,
      forcePathStyle: Boolean(config.STORAGE_ENDPOINT),
      credentials: explicitCredentials,
    });
  }

  private encryption() {
    return this.config.STORAGE_KMS_KEY_ID
      ? { ServerSideEncryption: 'aws:kms' as const, SSEKMSKeyId: this.config.STORAGE_KMS_KEY_ID }
      : { ServerSideEncryption: 'AES256' as const };
  }

  async createSignedUpload(input: CreateUploadInput): Promise<SignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.config.STORAGE_BUCKET,
      Key: input.key,
      ContentType: input.mimeType,
      ContentLength: input.fileSize,
      ChecksumSHA256: input.checksumSha256,
      ...this.encryption(),
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds });
    const headers: Record<string, string> = { 'content-type': input.mimeType };
    headers['x-amz-server-side-encryption'] = this.config.STORAGE_KMS_KEY_ID ? 'aws:kms' : 'AES256';
    if (this.config.STORAGE_KMS_KEY_ID) headers['x-amz-server-side-encryption-aws-kms-key-id'] = this.config.STORAGE_KMS_KEY_ID;
    if (input.checksumSha256) headers['x-amz-checksum-sha256'] = input.checksumSha256;
    return { url, method: 'PUT', headers, expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000) };
  }

  createSignedReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.config.STORAGE_BUCKET, Key: key }), { expiresIn: expiresInSeconds });
  }

  async head(key: string): Promise<ObjectMetadata> {
    const result = await this.client.send(new HeadObjectCommand({ Bucket: this.config.STORAGE_BUCKET, Key: key }));
    return { size: result.ContentLength ?? 0, contentType: result.ContentType };
  }

  async readHeader(key: string, bytes = 4096): Promise<Uint8Array> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.STORAGE_BUCKET, Key: key, Range: `bytes=0-${bytes - 1}` }));
    if (!result.Body) throw new Error('Storage object has no body');
    return result.Body.transformToByteArray();
  }

  async stream(key: string): Promise<AsyncIterable<Uint8Array>> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.STORAGE_BUCKET, Key: key }));
    if (!result.Body) throw new Error('Storage object has no body');
    return result.Body as AsyncIterable<Uint8Array>;
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.STORAGE_BUCKET, Key: key }));
  }
}
