export interface CreateUploadInput {
  key: string;
  mimeType: string;
  fileSize: number;
  checksumSha256?: string;
  expiresInSeconds: number;
}

export interface SignedUpload {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface ObjectMetadata {
  size: number;
  contentType?: string;
}

export interface ObjectStorage {
  createSignedUpload(input: CreateUploadInput): Promise<SignedUpload>;
  createSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
  head(key: string): Promise<ObjectMetadata>;
  readHeader(key: string, bytes?: number): Promise<Uint8Array>;
  stream(key: string): Promise<AsyncIterable<Uint8Array>>;
  remove(key: string): Promise<void>;
}
