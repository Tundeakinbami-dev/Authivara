import { uploadToSignedUrl } from './upload';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
export const apiEnabled = process.env.NEXT_PUBLIC_API_ENABLED === 'true';

interface ApiErrorEnvelope { error?: { message?: string } }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ApiErrorEnvelope;
    const error = new Error(payload.error?.message ?? `Request failed with status ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export interface ApiContent {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  tags: string[];
  fileName: string;
  mimeType: string;
  fileSize: number;
  contentHash: string;
  hashAlgorithm: string;
  status: string;
  visibility: string;
  createdAt: string;
  versionNumber: number;
  proof?: { proofId: string; status: string; network: string; transactionHash: string | null; timestamp: string } | null;
  certificate?: { certificateNumber: string; publicVerificationUrl: string } | null;
}

export async function currentUser() {
  return request<{ user: { id: string; email: string } }>('/v1/auth/me');
}

export async function listContent(): Promise<ApiContent[]> {
  return (await request<{ content: ApiContent[] }>('/v1/content')).content;
}

export interface RegisterFileInput {
  file: File;
  clientHash: string;
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  visibility?: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
  onUploadProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export async function registerFile(input: RegisterFileInput) {
  const initiated = await request<{ uploadId: string; upload: { url: string; method: 'PUT'; headers: Record<string, string> } }>('/v1/uploads', {
    method: 'POST', body: JSON.stringify({ fileName: input.file.name, mimeType: input.file.type, fileSize: input.file.size }),
  });
  try {
    await uploadToSignedUrl(input.file, initiated.upload, { signal: input.signal, onProgress: input.onUploadProgress, retries: 2 });
    const finalized = await request<{ duplicate: DuplicateNotice }>(`/v1/uploads/${initiated.uploadId}/complete`, { method: 'POST', body: JSON.stringify({ clientHash: input.clientHash }) });
    const registered = await request<{
      content: { id: string; title: string; category: string; fileName: string; mimeType: string; fileSize: number; contentHash: string; createdAt: string };
      proof: { proofId: string; status: string; blockchainNetwork: string; transactionHash: string | null };
      certificate: { certificateNumber: string; publicVerificationUrl: string };
      duplicateNotice?: DuplicateNotice | null;
    }>('/v1/content/register', {
      method: 'POST',
      body: JSON.stringify({ uploadId: initiated.uploadId, title: input.title, description: input.description, category: input.category, tags: input.tags ?? [], visibility: input.visibility ?? 'PRIVATE' }),
    });
    return { ...registered, duplicateNotice: registered.duplicateNotice ?? (finalized.duplicate.type === 'NONE' ? null : finalized.duplicate) };
  } catch (error) {
    await request(`/v1/uploads/${initiated.uploadId}`, { method: 'DELETE' }).catch(() => undefined);
    throw error;
  }
}

export interface DuplicateNotice {
  type: 'NONE' | 'SAME_USER' | 'SAME_ORGANIZATION' | 'PUBLIC';
  message: string;
  contentId?: string;
  proofId?: string;
  title?: string;
}

export async function signUp(input: { email: string; password: string; name: string; username: string; displayName: string; country?: string }) {
  return request<{ user: { id: string; email: string } }>('/v1/auth/signup', { method: 'POST', body: JSON.stringify(input) });
}

export async function login(input: { email: string; password: string }) {
  return request<{ user: { id: string; email: string } }>('/v1/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

export async function verifyMagicLink(token: string) {
  return request<{ user: { id: string; email: string } }>('/v1/auth/magic-link/verify', { method: 'POST', body: JSON.stringify({ token }) });
}

export async function createShareLink(certificateNumber: string) {
  return request<{ publicVerificationUrl: string; expiresAt: string | null }>(`/v1/certificates/${encodeURIComponent(certificateNumber)}/share`, {
    method: 'POST', body: JSON.stringify({ expiresInHours: 168 }),
  });
}

export async function downloadCertificatePdf(certificateNumber: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/v1/certificates/${encodeURIComponent(certificateNumber)}/pdf`, { credentials: 'include' });
  if (!response.ok) throw new Error('Certificate PDF could not be generated.');
  return response.blob();
}

export async function downloadPublicCertificatePdf(proofId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/v1/public/proofs/id/${encodeURIComponent(proofId)}/certificate.pdf`);
  if (!response.ok) throw new Error('Public certificate PDF could not be generated.');
  return response.blob();
}

export interface DashboardSummary {
  totalWorks: number;
  verifiedWorks: number;
  pendingProofs: number;
  licensedWorks: number;
  verificationRequests: number;
  storageUsageBytes: number;
}

export async function getDashboardSummary() {
  return request<DashboardSummary>('/v1/dashboard/summary');
}

export async function archiveContent(contentId: string) {
  return request<{ content: { id: string; status: 'ARCHIVED'; updatedAt: string } }>(`/v1/content/${encodeURIComponent(contentId)}/archive`, { method: 'PATCH' });
}

export interface ContentVersion {
  id: string;
  versionNumber: number;
  label: string | null;
  hash: string;
  hashAlgorithm: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  description: string | null;
  tags: string[];
  createdAt: string;
  creator: { id: string; name: string; username: string };
  proof: { proofId: string; status: string; network: string; transactionHash: string | null } | null;
}

export async function getContentVersions(contentId: string) {
  return (await request<{ versions: ContentVersion[] }>(`/v1/content/${encodeURIComponent(contentId)}/versions`)).versions;
}

export interface VersionComparison {
  from: ContentVersion;
  to: ContentVersion;
  comparison: { exactBytesEqual: boolean; hashesMatch: boolean; metadataDifferences: string[]; notice: string };
}

export async function compareContentVersions(contentId: string, from: number, to: number) {
  return request<VersionComparison>(`/v1/content/${encodeURIComponent(contentId)}/versions/compare?from=${from}&to=${to}`);
}

export interface PublicCertificate {
  certificateNumber: string;
  generatedAt: string;
  status: string;
  content: { title: string; category: string; visibility: string; creator: string };
  proof: { proofId: string; contentHash: string; network: string; transactionHash: string | null; status: string };
}

export interface PublicProof {
  heading: string;
  status: string;
  content: { title: string; type: string };
  registeredAt: string;
  proofId: string;
  hashAlgorithm: 'SHA-256';
  contentHash: string;
  metadataHash: string | null;
  blockchain: string;
  transactionHash: string | null;
  blockchainUrl: string | null;
  blockNumber: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
  certificate: { certificateNumber: string; generatedAt: string; status: string } | null;
  publicUrl: string;
}

export interface TimelineEvent {
  type: string;
  timestamp: string;
  title: string;
  detail: string;
}

export async function getPublicProof(proofId: string) {
  return request<{ proof: PublicProof; timeline: TimelineEvent[]; anchorVerified: boolean }>(`/v1/public/proofs/id/${encodeURIComponent(proofId)}`);
}

export async function verifyPublicFile(contentHash: string, proofId?: string) {
  return request<{
    result: 'MATCH' | 'NO_MATCH' | 'RELATED_VERSION' | 'INVALID_PROOF' | 'REVOKED';
    exactMatch: boolean;
    anchorVerified: boolean;
    relatedVersion?: { versionNumber: number; proofId: string | null; registeredAt: string } | null;
    proof?: PublicProof;
    notice: string;
  }>('/v1/public/verify', { method: 'POST', body: JSON.stringify({ contentHash, proofId }) });
}

export async function inspectSharedProof(shareToken: string) {
  return request<{ certificate: PublicCertificate }>(`/v1/public/proofs/${encodeURIComponent(shareToken)}`);
}

export async function verifySharedProof(shareToken: string, contentHash: string) {
  return request<{ result: 'MATCH' | 'NO_MATCH' | 'REVOKED'; exactMatch: boolean; anchorVerified: boolean; certificate: PublicCertificate; notice: string }>(
    `/v1/public/proofs/${encodeURIComponent(shareToken)}/verify`,
    { method: 'POST', body: JSON.stringify({ contentHash }) },
  );
}

// AI Content Provenance
export interface AiMetadata {
  id: string;
  contentId: string;
  origin: 'HUMAN_CREATED' | 'AI_ASSISTED' | 'AI_GENERATED' | 'AI_EDITED' | 'UNKNOWN';
  toolName: string | null;
  modelName: string | null;
  creationNotes: string | null;
  editingNotes: string | null;
  humanContributionNotes: string | null;
  independentlyVerified: boolean;
  disclosureSource: string;
}

export async function getAiMetadata(contentId: string) {
  return request<{ aiMetadata: AiMetadata | null }>(`/v1/content/${encodeURIComponent(contentId)}/ai-metadata`);
}

export async function upsertAiMetadata(contentId: string, input: { origin: AiMetadata['origin']; toolName?: string; modelName?: string; creationNotes?: string; editingNotes?: string; humanContributionNotes?: string }) {
  return request<{ aiMetadata: AiMetadata }>(`/v1/content/${encodeURIComponent(contentId)}/ai-metadata`, {
    method: 'PUT', body: JSON.stringify(input),
  });
}

export async function deleteAiMetadata(contentId: string) {
  return request<{ deleted: boolean }>(`/v1/content/${encodeURIComponent(contentId)}/ai-metadata`, { method: 'DELETE' });
}

// Licensing
export interface LicenseRecord {
  id: string;
  contentId: string;
  licensor: string;
  licensee: string;
  licenseType: string;
  exclusive: boolean;
  startDate: string;
  endDate: string | null;
  geographicScope: string | null;
  usageScope: string;
  impressions: number | null;
  modificationPermission: boolean;
  resalePermission: boolean;
  aiTrainingPermission: boolean;
  price: number | null;
  currency: string | null;
  status: string;
  createdAt: string;
  content?: { id: string; title: string; category: string };
  transferRecords?: LicenseTransfer[];
}

export interface LicenseTransfer {
  id: string;
  licenseId: string;
  fromLicensee: string;
  toLicensee: string;
  effectiveDate: string;
  agreementReference: string | null;
  notes: string | null;
  createdAt: string;
}

export async function createLicense(input: {
  contentId: string; licensor: string; licensee: string; licenseType: 'PERSONAL' | 'COMMERCIAL';
  exclusive?: boolean; startDate: string; endDate?: string; geographicScope?: string;
  usageScope: string; impressions?: number; modificationPermission?: boolean;
  resalePermission?: boolean; aiTrainingPermission?: boolean; price?: number; currency?: string;
}) {
  return request<{ license: LicenseRecord }>('/v1/licenses', { method: 'POST', body: JSON.stringify(input) });
}

export async function listLicenses() {
  return request<{ licenses: LicenseRecord[] }>('/v1/licenses');
}

export async function getLicense(licenseId: string) {
  return request<{ license: LicenseRecord }>(`/v1/licenses/${encodeURIComponent(licenseId)}`);
}

export async function getContentLicenses(contentId: string) {
  return request<{ licenses: LicenseRecord[] }>(`/v1/content/${encodeURIComponent(contentId)}/licenses`);
}

export async function updateLicenseStatus(licenseId: string, status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED') {
  return request<{ license: LicenseRecord }>(`/v1/licenses/${encodeURIComponent(licenseId)}/status`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  });
}

export async function transferLicense(licenseId: string, input: { toLicensee: string; effectiveDate: string; agreementReference?: string; notes?: string }) {
  return request<{ transfer: LicenseTransfer }>(`/v1/licenses/${encodeURIComponent(licenseId)}/transfer`, {
    method: 'POST', body: JSON.stringify(input),
  });
}

// Identity Verification
export interface VerificationStatus {
  verificationLevel: number;
  verificationStatus: string;
  verificationProvider: string | null;
  verifiedAt: string | null;
  emailVerified: boolean;
}

export async function getVerificationStatus() {
  return request<VerificationStatus>('/v1/profile/verification');
}

export async function initiateVerification(level: number, provider?: string) {
  return request<{ verificationLevel: number; verificationStatus: string; verifiedAt: string | null }>('/v1/profile/verification/initiate', {
    method: 'POST', body: JSON.stringify({ level, provider }),
  });
}

export async function completeKycVerification() {
  return request<{ verificationLevel: number; verificationStatus: string; verifiedAt: string | null }>('/v1/profile/verification/kyc', {
    method: 'POST',
  });
}

export async function getVerificationBadge(userId: string) {
  return request<{ verificationLevel: number; verificationStatus: string; badge: string }>(`/v1/users/${encodeURIComponent(userId)}/verification-badge`);
}
