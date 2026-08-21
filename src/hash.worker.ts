/// <reference lib="webworker" />

import { createSHA256 } from 'hash-wasm';

interface HashRequest {
  id: string;
  file: File;
}

self.onmessage = async (event: MessageEvent<HashRequest>) => {
  const { id, file } = event.data;
  try {
    const hasher = await createSHA256();
    hasher.init();
    const reader = file.stream().getReader();
    let processed = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hasher.update(value);
      processed += value.byteLength;
      self.postMessage({ id, type: 'progress', processed, total: file.size });
    }
    self.postMessage({ id, type: 'complete', digest: hasher.digest('hex') });
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : 'Unable to hash file' });
  }
};

export {};
