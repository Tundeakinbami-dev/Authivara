export async function sha256(file: File, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<string> {
  if (typeof Worker === 'undefined') {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    onProgress?.(1);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' });
    const id = crypto.randomUUID();
    const stop = () => { worker.terminate(); reject(new DOMException('Hashing cancelled', 'AbortError')); };
    signal?.addEventListener('abort', stop, { once: true });
    worker.onmessage = (event: MessageEvent<{ id: string; type: 'progress' | 'complete' | 'error'; processed?: number; total?: number; digest?: string; message?: string }>) => {
      if (event.data.id !== id) return;
      if (event.data.type === 'progress') onProgress?.((event.data.processed ?? 0) / (event.data.total || 1));
      if (event.data.type === 'error') {
        signal?.removeEventListener('abort', stop);
        worker.terminate();
        reject(new Error(event.data.message));
      }
      if (event.data.type === 'complete' && event.data.digest) {
        signal?.removeEventListener('abort', stop);
        worker.terminate();
        onProgress?.(1);
        resolve(event.data.digest);
      }
    };
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message)); };
    worker.postMessage({ id, file });
  });
}

export function shortenHash(hash: string, start = 8, end = 6): string {
  return `${hash.slice(0, start)}…${hash.slice(-end)}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

export function createAnchor(hash: string): string {
  return `0x${hash.slice(16)}${hash.slice(0, 16)}`;
}
