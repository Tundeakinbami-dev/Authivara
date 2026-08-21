const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

const allowed: Record<string, readonly string[]> = {
  jpg: ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'], webp: ['image/webp'],
  pdf: ['application/pdf'], mp4: ['video/mp4'], mov: ['video/quicktime'], mp3: ['audio/mpeg'],
  wav: ['audio/wav', 'audio/x-wav'], docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  txt: ['text/plain'], zip: ['application/zip', 'application/x-zip-compressed'],
  psd: ['image/vnd.adobe.photoshop', 'application/octet-stream'], ai: ['application/pdf', 'application/postscript'],
  fig: ['application/zip', 'application/octet-stream'],
};

export function validateClientFile(file: File): string | null {
  if (file.size <= 0) return 'The selected file is empty.';
  if (file.size > MAX_FILE_BYTES) return 'The selected file is larger than the 2 GB limit.';
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!allowed[extension]?.includes(file.type.toLowerCase())) {
    return 'This file extension and MIME type are not an allowed combination.';
  }
  return null;
}
