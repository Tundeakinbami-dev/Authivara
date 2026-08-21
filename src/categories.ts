import type { WorkType } from './types';

export const CONTENT_CATEGORIES = [
  'Photography', 'Music', 'Video', 'Writing', 'Illustration', 'Design', 'Software',
  'Research', 'Architecture', 'Fashion', '3D', 'Document', 'Other',
] as const;

export function categoryWorkType(category: string): WorkType {
  if (['Photography', 'Illustration'].includes(category)) return 'Image';
  if (category === 'Music') return 'Audio';
  if (category === 'Video') return 'Video';
  if (['Writing', 'Research', 'Document'].includes(category)) return 'Document';
  if (['Design', 'Architecture', 'Fashion', '3D'].includes(category)) return 'Design';
  if (category === 'Software') return 'Code';
  return 'Other';
}

export function inferCategory(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'webp'].includes(extension)) return 'Photography';
  if (['wav', 'mp3', 'flac', 'aac'].includes(extension)) return 'Music';
  if (['mp4', 'mov', 'mkv'].includes(extension)) return 'Video';
  if (['doc', 'docx', 'txt'].includes(extension)) return 'Writing';
  if (extension === 'pdf') return 'Document';
  if (['ai', 'psd', 'fig'].includes(extension)) return 'Design';
  if (['zip'].includes(extension)) return 'Software';
  return 'Other';
}
