export interface SignedUploadInstruction {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export interface UploadOptions {
  signal?: AbortSignal;
  retries?: number;
  onProgress?: (fraction: number) => void;
}

/** Uploads directly to private object storage; file bytes never pass through the proof API. */
export async function uploadToSignedUrl(file: File, instruction: SignedUploadInstruction, options: UploadOptions = {}): Promise<void> {
  const retries = options.retries ?? 2;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await uploadOnce(file, instruction, options);
      return;
    } catch (error) {
      if (options.signal?.aborted || attempt === retries) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 300 * 2 ** attempt));
    }
  }
}

function uploadOnce(file: File, instruction: SignedUploadInstruction, options: UploadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(instruction.method, instruction.url);
    Object.entries(instruction.headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.onprogress = (event) => event.lengthComputable && options.onProgress?.(event.loaded / event.total);
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Upload failed with status ${request.status}`));
    request.onerror = () => reject(new Error('Upload failed due to a network error'));
    request.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    const abort = () => request.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    request.onloadend = () => options.signal?.removeEventListener('abort', abort);
    request.send(file);
  });
}
