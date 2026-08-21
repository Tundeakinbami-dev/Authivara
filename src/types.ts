export type WorkType = 'Image' | 'Audio' | 'Video' | 'Document' | 'Design' | 'Code' | 'Other';
export type ProofStatus = 'Anchored' | 'Pending' | 'Draft';

export interface ProofWork {
  id: string;
  title: string;
  type: WorkType;
  category?: string;
  tags?: string[];
  filename: string;
  fileSize: number;
  hash: string;
  algorithm: 'SHA-256';
  registeredAt: string;
  status: ProofStatus;
  certificateId: string;
  anchorId: string;
  network: string;
  version: number;
  creator: string;
  note?: string;
  color: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  detail: string;
  time: string;
  tone: 'teal' | 'blue' | 'amber' | 'purple';
}
