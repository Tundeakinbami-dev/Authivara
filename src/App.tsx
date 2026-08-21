'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FileCheck2,
  FileImage,
  FileKey2,
  FileMusic,
  FileText,
  FileVideo,
  Fingerprint,
  FolderKanban,
  Globe2,
  History,
  Home,
  KeyRound,
  LayoutGrid,
  List,
  Library,
  Link2,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Scale,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRoundCheck,
  Users,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import { seedActivity } from './data';
import { createAnchor, formatBytes, sha256, shortenHash } from './crypto';
import { loadWorks, saveWorks } from './storage';
import type { ProofWork, WorkType } from './types';
import { validateClientFile } from './filePolicy';
import { CONTENT_CATEGORIES, categoryWorkType, inferCategory } from './categories';
import { apiEnabled, archiveContent, compareContentVersions, createShareLink, currentUser, downloadCertificatePdf, getContentVersions, getDashboardSummary, listContent, registerFile, type ApiContent, type ContentVersion, type DashboardSummary, type VersionComparison, getAiMetadata, upsertAiMetadata, type AiMetadata, listLicenses, createLicense, updateLicenseStatus, transferLicense, type LicenseRecord, type LicenseTransfer, getVerificationStatus, initiateVerification, type VerificationStatus } from './api/client';

type Page = 'Overview' | 'My works' | 'Verify a work' | 'Provenance' | 'Licences' | 'Rights' | 'Team' | 'API & integrations' | 'Settings';

const navPrimary: { label: Page; icon: typeof Home }[] = [
  { label: 'Overview', icon: LayoutGrid },
  { label: 'My works', icon: Library },
  { label: 'Verify a work', icon: ShieldCheck },
  { label: 'Provenance', icon: History },
  { label: 'Rights', icon: Scale },
];

const navWorkspace: { label: Page; icon: typeof Home }[] = [
  { label: 'Team', icon: Users },
  { label: 'API & integrations', icon: Code2 },
  { label: 'Settings', icon: Settings },
];

const typeIcons: Record<WorkType, typeof FileText> = {
  Image: FileImage,
  Audio: FileMusic,
  Video: FileVideo,
  Document: FileText,
  Design: Sparkles,
  Code: Code2,
  Other: FileArchive,
};

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Authivara">
      <div className="brand-mark"><Fingerprint size={23} strokeWidth={2.2} /></div>
      {!compact && <span>authivara</span>}
    </div>
  );
}

function Sidebar({ page, setPage, open, close, workCount }: { page: Page; setPage: (p: Page) => void; open: boolean; close: () => void; workCount: number }) {
  const choose = (next: Page) => { setPage(next); close(); };
  return (
    <>
      {open && <button className="scrim" onClick={close} aria-label="Close navigation" />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo"><Logo /></div>
        <button className="workspace-switcher">
          <span className="avatar avatar-small">AO</span>
          <span><strong>Amina Studio</strong><small>Creator workspace</small></span>
          <ChevronDown size={16} />
        </button>

        <nav aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {navPrimary.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => choose(label)}>
              <Icon size={18} /><span>{label}</span>
              {label === 'My works' && <em>{workCount}</em>}
            </button>
          ))}
          <p className="nav-label nav-label-spaced">Manage</p>
          {navWorkspace.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${page === label ? 'active' : ''}`} onClick={() => choose(label)}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="plan-card">
          <div><span>Creator plan</span><strong>8 of 25 proofs</strong></div>
          <div className="plan-track"><span /></div>
          <button>View usage <ArrowRight size={14} /></button>
        </div>
        <button className="support-link"><CircleHelp size={17} /> Help & support</button>
      </aside>
    </>
  );
}

function Topbar({ title, openMenu, onRegister }: { title: string; openMenu: () => void; onRegister: () => void }) {
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={openMenu} aria-label="Open navigation"><Menu size={22} /></button>
      <div className="mobile-brand"><Logo /></div>
      <div className="breadcrumb"><span>Amina Studio</span><ChevronRight size={14} /><strong>{title}</strong></div>
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Search"><Search size={19} /></button>
        <button className="icon-button notification" aria-label="Notifications"><Bell size={19} /><i /></button>
        <button className="primary compact" onClick={onRegister}><Plus size={17} /> Register work</button>
        <button className="avatar-button"><span className="avatar">AO</span><ChevronDown size={15} /></button>
      </div>
    </header>
  );
}

function PageHeading({ eyebrow, title, copy, actions }: { eyebrow?: string; title: string; copy: string; actions?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{copy}</p></div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Home; label: string; value: string; detail: string; tone: string }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={20} /></div>
      <div className="stat-label">{label}<CircleHelp size={13} /></div>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function WorkIcon({ work, large = false }: { work: ProofWork; large?: boolean }) {
  const Icon = typeIcons[work.type];
  return <div className={`work-icon ${large ? 'large' : ''}`} style={{ '--work-color': work.color } as React.CSSProperties}><Icon size={large ? 26 : 19} /></div>;
}

function WorkRow({ work, onOpen }: { work: ProofWork; onOpen: (w: ProofWork) => void }) {
  return (
    <button className="work-row" onClick={() => onOpen(work)}>
      <div className="work-main"><WorkIcon work={work} /><span><strong>{work.title}</strong><small>{work.type} · {formatBytes(work.fileSize)}</small></span></div>
      <span className="hide-tablet">{new Date(work.registeredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      <span className="hash-cell hide-mobile"><code>{shortenHash(work.hash)}</code><Copy size={13} /></span>
      <span className="status-pill"><Check size={12} /> {work.status}</span>
      <MoreHorizontal size={18} className="row-more" />
    </button>
  );
}

function Overview({ works, summary, setPage, onRegister, onOpen }: { works: ProofWork[]; summary: DashboardSummary; setPage: (p: Page) => void; onRegister: () => void; onOpen: (w: ProofWork) => void }) {
  return (
    <div className="content-wrap">
      <PageHeading title="Good morning, Amina" copy="Here’s the evidence record for your creative work." actions={<button className="primary" onClick={onRegister}><Plus size={17} /> Register a new work</button>} />

      <section className="trust-banner">
        <div className="trust-art"><Fingerprint size={30} /><span /><span /></div>
        <div><span className="banner-kicker"><ShieldCheck size={14} /> Privacy-first proof</span><h2>Your files stay yours.</h2><p>Authivara fingerprints your work in your browser. Only its cryptographic hash—not your original content—is used to create a timestamped record.</p></div>
        <button className="text-button">How proof works <ArrowRight size={15} /></button>
      </section>

      <section className="stats-grid">
        <StatCard icon={FileKey2} label="Total works" value={String(summary.totalWorks)} detail="Registered content" tone="mint" />
        <StatCard icon={BadgeCheck} label="Verified works" value={String(summary.verifiedWorks)} detail="Confirmed proofs" tone="blue" />
        <StatCard icon={Clock3} label="Pending proofs" value={String(summary.pendingProofs)} detail="Awaiting confirmation" tone="gold" />
        <StatCard icon={WalletCards} label="Licensed works" value={String(summary.licensedWorks)} detail="Active licences" tone="purple" />
        <StatCard icon={Globe2} label="Verification requests" value={String(summary.verificationRequests)} detail="All recorded checks" tone="blue" />
        <StatCard icon={FileArchive} label="Storage usage" value={formatBytes(summary.storageUsageBytes)} detail="Encrypted versions" tone="mint" />
      </section>

      <div className="dashboard-grid">
        <section className="panel works-panel">
          <div className="panel-heading"><div><h3>Recent works</h3><p>Your latest registered content</p></div><button className="text-button" onClick={() => setPage('My works')}>View all <ArrowRight size={15} /></button></div>
          <div className="table-head"><span>Work</span><span className="hide-tablet">Registered</span><span className="hide-mobile">Fingerprint</span><span>Status</span><span /></div>
          <div className="work-list">{works.slice(0, 4).map((work) => <WorkRow key={work.id} work={work} onOpen={onOpen} />)}</div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading"><div><h3>Recent activity</h3><p>Updates across your workspace</p></div><button className="icon-button mini"><MoreHorizontal size={18} /></button></div>
          <div className="activity-list">
            {seedActivity.map((item) => <div className="activity-item" key={item.id}><span className={`activity-dot ${item.tone}`} /><div><strong>{item.action}</strong><span>{item.detail}</span><small>{item.time}</small></div></div>)}
          </div>
          <button className="panel-footer">View activity log <ArrowRight size={14} /></button>
        </section>
      </div>

      <section className="how-grid">
        <div className="how-intro"><span className="eyebrow">Your evidence chain</span><h2>From private file to verifiable proof</h2><p>Each step strengthens provenance without publishing your content.</p></div>
        <div className="how-step"><span>01</span><Fingerprint size={22} /><strong>Fingerprint locally</strong><p>SHA-256 is calculated in your browser.</p></div>
        <div className="how-arrow"><ArrowRight size={18} /></div>
        <div className="how-step"><span>02</span><Clock3 size={22} /><strong>Anchor the timestamp</strong><p>The fingerprint enters a tamper-resistant record.</p></div>
        <div className="how-arrow"><ArrowRight size={18} /></div>
        <div className="how-step"><span>03</span><ShieldCheck size={22} /><strong>Verify at any time</strong><p>Match a file against the original proof.</p></div>
      </section>
    </div>
  );
}

function WorksPage({ works, onRegister, onOpen, onHistory, onArchive, setPage, toast }: {
  works: ProofWork[]; onRegister: () => void; onOpen: (w: ProofWork) => void; onHistory: (w: ProofWork) => void;
  onArchive: (w: ProofWork) => void; setPage: (page: Page) => void; toast: (message: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | WorkType>('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const filtered = works.filter((work) => (filter === 'All' || work.type === filter) && `${work.title} ${work.filename}`.toLowerCase().includes(query.toLowerCase()));
  async function download(work: ProofWork) {
    try {
      if (!apiEnabled) { onOpen(work); toast('Open the proof to export the sandbox record'); return; }
      const blob = await downloadCertificatePdf(work.certificateId);
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${work.certificateId}.pdf`; link.click(); URL.revokeObjectURL(url);
      toast('Certificate PDF downloaded');
    } catch (error) { toast(error instanceof Error ? error.message : 'Certificate download failed'); }
  }
  async function share(work: ProofWork) {
    try {
      const link = apiEnabled ? (await createShareLink(work.certificateId)).publicVerificationUrl : `${window.location.origin}/verify?hash=${work.hash}`;
      await navigator.clipboard.writeText(link); toast('Verification link copied');
    } catch (error) { toast(error instanceof Error ? error.message : 'Unable to share proof'); }
  }
  return (
    <div className="content-wrap">
      <PageHeading title="My works" copy="Manage every fingerprint, timestamp, version, and certificate in your workspace." actions={<button className="primary" onClick={onRegister}><Plus size={17} /> Register work</button>} />
      <section className="panel library-panel">
        <div className="library-tools">
          <label className="search-input"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search works or filenames" /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value as 'All' | WorkType)} aria-label="Filter by content type">
            <option>All</option><option>Image</option><option>Audio</option><option>Video</option><option>Document</option><option>Design</option><option>Code</option>
          </select>
          <div className="view-toggle" aria-label="Content view"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><LayoutGrid size={16} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={16} /></button></div>
          <button className="secondary"><Download size={16} /> Export</button>
        </div>
        <div className={`works-card-grid ${view === 'list' ? 'list-view' : ''}`}>
          {filtered.map((work) => (
            <article className="work-card" key={work.id}>
              <div className="work-card-top"><WorkIcon work={work} large /><span className="status-pill"><Check size={12} /> {work.status}</span></div>
              <h3>{work.title}</h3><p>{work.filename}</p>
              <div className="work-meta"><span>{work.type}</span><span>v{work.version}</span><span>{formatBytes(work.fileSize)}</span></div>
              <div className="work-card-hash"><Fingerprint size={15} /><code>{shortenHash(work.hash, 10, 8)}</code></div>
              <div className="work-statuses"><span>Proof: {work.status}</span><span>Verification: {work.status === 'Anchored' ? 'Verified' : 'Pending'}</span></div>
              <div className="work-card-foot"><span>{new Date(work.registeredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
              <div className="work-actions">
                <button onClick={() => onOpen(work)}>View</button><button onClick={() => setPage('Verify a work')}>Verify</button>
                <button onClick={() => download(work)}>Certificate</button><button onClick={() => share(work)}>Share</button>
                <button onClick={() => setPage('Licences')}>License</button><button onClick={() => onHistory(work)}>Versions</button>
                <button className="danger-link" onClick={() => onArchive(work)}>Archive</button>
              </div>
            </article>
          ))}
        </div>
        {!filtered.length && <div className="empty-state"><Search size={30} /><h3>No works found</h3><p>Try another title or content type.</p></div>}
      </section>
    </div>
  );
}

function RegisterPage({ works, onComplete, onCancel }: {
  works: ProofWork[];
  onComplete: (work: ProofWork, file: File, onUploadProgress: (fraction: number) => void, metadata: { visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC'; category: string; tags: string[] }) => Promise<ProofWork>;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState('');
  const [hashing, setHashing] = useState(false);
  const [hashProgress, setHashProgress] = useState(0);
  const [fileError, setFileError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Photography');
  const [customCategory, setCustomCategory] = useState('');
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'UNLISTED' | 'PUBLIC'>('PRIVATE');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [issuedWork, setIssuedWork] = useState<ProofWork | null>(null);
  const resolvedCategory = category === '__custom' ? customCategory.trim() : category;
  const type = categoryWorkType(resolvedCategory);

  async function processFile(nextFile?: File) {
    if (!nextFile) return;
    const validationError = validateClientFile(nextFile);
    if (validationError) { setFile(null); setHash(''); setFileError(validationError); return; }
    setFileError(''); setFile(nextFile); setHash(''); setTitle(nextFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    setCategory(inferCategory(nextFile.name));
  }

  async function generateFingerprint() {
    if (!file || !title.trim() || !resolvedCategory) return;
    setStep(3); setHashing(true); setHashProgress(0); setFileError('');
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const digest = await sha256(file, setHashProgress);
      setHash(digest); setStep(4);
    } catch {
      setFileError('The file could not be fingerprinted. Please try again.'); setHash(''); setStep(2);
    } finally { setHashing(false); }
  }

  async function issueProof() {
    if (!file || !hash || !confirmed) return;
    const number = 43 + works.length - 4;
    const work: ProofWork = {
      id: `wrk_${String(number).padStart(4, '0')}`,
      title: title.trim(), type, category: resolvedCategory, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean), filename: file.name, fileSize: file.size, hash, algorithm: 'SHA-256',
      registeredAt: new Date().toISOString(), status: 'Anchored', certificateId: `AV-NG-2026-${String(number).padStart(6, '0')}`,
      anchorId: createAnchor(hash), network: 'Authivara Sandbox Anchor', version: 1, creator: 'Amina Okafor', note, color: '#e2a568',
    };
    setSubmitting(true); setSubmitError('');
    try {
      const issued = await onComplete(work, file, setUploadProgress, { visibility, category: resolvedCategory, tags: work.tags ?? [] });
      setIssuedWork(issued); setStep(6);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'The proof could not be created.');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="register-shell">
      <div className="register-top"><button className="back-button" onClick={onCancel}><X size={18} /> Close</button><div className="secure-note"><LockKeyhole size={15} /> Private, local fingerprinting</div></div>
      <div className="register-inner">
        <div className="stepper">
          {[['1', 'Select'], ['2', 'Describe'], ['3', 'Fingerprint'], ['4', 'Hash'], ['5', 'Create proof'], ['6', 'Confirmed']].map(([number, label], index) => <div className={`${step > index + 1 ? 'done' : ''} ${step === index + 1 ? 'current' : ''}`} key={number}><span>{step > index + 1 ? <Check size={14} /> : number}</span><strong>{label}</strong></div>)}
        </div>

        {step === 1 && <div className="register-card">
          <span className="eyebrow">Step 1 of 6</span><h1>Select your work</h1><p className="register-lead">Choose the exact file you want to register. Validation checks the file itself, not only its extension.</p>
          {!file ? <button className={`dropzone ${dragging ? 'dragging' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); }}>
            <div className="upload-icon"><UploadCloud size={26} /></div><strong>Drop your file here</strong><span>or click to browse your device</span><small>JPEG, PNG, WEBP, PDF, MP4, MOV, MP3, WAV, DOCX, TXT, ZIP and supported design files · Maximum 2 GB</small>
          </button> : <div className="selected-file"><WorkIcon work={{ type, color: '#60a593' } as ProofWork} large /><div><strong>{file.name}</strong><span>{formatBytes(file.size)} · {file.type || 'Unknown file type'}</span></div><span className="success-check"><Check size={16} /></span><button onClick={() => { setFile(null); setHash(''); }}><X size={17} /></button></div>}
          <input ref={inputRef} hidden type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov,.mp3,.wav,.docx,.txt,.zip,.psd,.ai,.fig" onChange={(e) => processFile(e.target.files?.[0])} />
          {fileError && <p className="file-error" role="alert">{fileError}</p>}
          <div className="privacy-note"><ShieldCheck size={19} /><div><strong>Your content remains private</strong><p>The original file does not leave this device during fingerprinting. Authivara records the resulting hash and the metadata you approve.</p></div></div>
          <div className="register-actions"><button className="secondary" onClick={onCancel}>Cancel</button><button className="primary" disabled={!file} onClick={() => setStep(2)}>Continue <ArrowRight size={16} /></button></div>
        </div>}

        {step === 2 && <div className="register-card">
          <span className="eyebrow">Step 2 of 6</span><h1>Describe this work</h1><p className="register-lead">Add useful context to the evidence record. Custom categories and tags remain distinct from the canonical file hash.</p>
          <div className="form-grid">
            <label className="field full"><span>Work title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give your work a clear title" /></label>
            <label className="field"><span>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{CONTENT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}<option value="__custom">Custom category…</option></select></label>
            {category === '__custom' && <label className="field"><span>Custom category</span><input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} placeholder="e.g. Ceramics" /></label>}
            <label className="field"><span>Creator identity</span><div className="verified-input"><UserRoundCheck size={16} /><span>Amina Okafor</span><small>Verified</small></div></label>
            <label className="field"><span>Proof visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="PRIVATE">Private</option><option value="UNLISTED">Unlisted link</option><option value="PUBLIC">Public proof page</option></select></label>
            <label className="field full"><span>Tags <em>Optional · comma separated</em></span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="sunset, editorial, client-a" /></label>
            <label className="field full"><span>Description <em>Optional</em></span><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Creation context, version details, or collaborators…" /></label>
          </div>
          <div className="scope-callout"><CircleHelp size={18} /><p><strong>What this record says:</strong> this exact file fingerprint was submitted by this account at the recorded time. It does not replace government copyright registration or adjudicate competing ownership claims.</p></div>
          <div className="register-actions"><button className="secondary" onClick={() => setStep(1)}>Back</button><button className="primary" disabled={!title.trim() || !resolvedCategory} onClick={generateFingerprint}><Fingerprint size={16} /> Generate fingerprint</button></div>
        </div>}

        {step === 3 && <div className="register-card fingerprint-stage" role="status">
          <span className="spinner large" /><span className="eyebrow">Step 3 of 6</span><h1>Generating cryptographic fingerprint…</h1><p className="register-lead">SHA-256 is being calculated from the exact file bytes in your browser.</p>
          <div className="hash-progress"><span style={{ width: `${Math.round(hashProgress * 100)}%` }} /><small>{Math.round(hashProgress * 100)}% complete</small></div>
          <div className="privacy-note"><LockKeyhole size={19} /><div><strong>The canonical hash comes from file bytes</strong><p>Filename, timestamps, file size, and EXIF metadata are never used as substitutes for the fingerprint.</p></div></div>
        </div>}

        {step === 4 && <div className="register-card">
          <span className="eyebrow">Step 4 of 6</span><h1>Fingerprint generated</h1><p className="register-lead">This is the canonical SHA-256 fingerprint of the exact file bytes.</p>
          <div className="hash-result hash-result-large"><div><Fingerprint size={20} /><span><small>SHA-256 content fingerprint</small><code>{hash}</code></span></div><span className="local-chip"><LockKeyhole size={12} /> Created locally</span></div>
          <div className="scope-callout"><CircleHelp size={18} /><p>Any byte-level change creates a different hash. Metadata and preview hashes, when used, remain separate and never replace this canonical fingerprint.</p></div>
          <div className="register-actions"><button className="secondary" onClick={() => setStep(2)}>Back</button><button className="primary" onClick={() => setStep(5)}>Continue to proof <ArrowRight size={16} /></button></div>
        </div>}

        {step === 5 && <div className="register-card">
          <span className="eyebrow">Step 5 of 6</span><h1>Create the blockchain proof</h1><p className="register-lead">Review the minimum information that will be anchored. The original private file is never written to a public blockchain.</p>
          <div className="review-work"><WorkIcon work={{ type, color: '#60a593' } as ProofWork} large /><div><h3>{title}</h3><p>{file?.name} · {formatBytes(file?.size || 0)}</p></div><span className="status-pill"><ShieldCheck size={12} /> Ready</span></div>
          <dl className="review-list"><div><dt>Creator identity</dt><dd>Amina Okafor <BadgeCheck size={15} /></dd></div><div><dt>Category</dt><dd>{resolvedCategory}</dd></div><div><dt>Fingerprint method</dt><dd>SHA-256 · exact bytes</dd></div><div><dt>Fingerprint</dt><dd><code>{shortenHash(hash, 14, 12)}</code></dd></div><div><dt>Timestamp</dt><dd>Recorded when the anchor is accepted</dd></div><div><dt>Public blockchain data</dt><dd>Hash + proof reference only</dd></div></dl>
          <label className="check-row"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span><i><Check size={13} /></i>I understand this creates evidence of existence and provenance, not automatic copyright ownership or a legal judgment.</span></label>
          {submitting && apiEnabled && <div className="hash-progress" role="status"><span style={{ width: `${Math.round(uploadProgress * 100)}%` }} /><small>Secure upload {Math.round(uploadProgress * 100)}%</small></div>}
          {submitError && <p className="file-error" role="alert">{submitError}</p>}
          <div className="register-actions"><button className="secondary" disabled={submitting} onClick={() => setStep(4)}>Back</button><button className="primary" disabled={!confirmed || submitting} onClick={issueProof}><Fingerprint size={16} /> {submitting ? 'Creating blockchain proof…' : 'Create blockchain proof'}</button></div>
        </div>}

        {step === 6 && <div className="register-card success-card">
          <div className="success-orbit"><BadgeCheck size={42} /></div><span className="eyebrow">Step 6 of 6 · confirmed</span><h1>Your work now has a verifiable provenance record.</h1><p>{apiEnabled ? 'The original is stored in the encrypted private vault. Only the hash and approved proof metadata were sent for anchoring.' : 'The file fingerprint is anchored in this sandbox demonstration. Your original content stayed on your device.'}</p>
          <div className="success-certificate"><span>Certificate</span><strong>{issuedWork?.certificateId ?? `AV-NG-2026-${String(43 + works.length - 4).padStart(6, '0')}`}</strong><small><Check size={13} /> Proof submitted</small></div>
          <div className="success-actions"><button className="secondary" onClick={onCancel}><Library size={16} /> View my works</button><button className="primary" onClick={onCancel}><Share2 size={16} /> View proof</button></div>
          {!apiEnabled && <small className="sandbox-disclosure"><CircleHelp size={13} /> Demo anchors are clearly labelled and are not submitted to a live public blockchain.</small>}
        </div>}
      </div>
    </div>
  );
}

function VerifyPage({ works, onOpen }: { works: ProofWork[]; onOpen: (work: ProofWork) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'hashing' | 'match' | 'none'>('idle');
  const [name, setName] = useState('');
  const [digest, setDigest] = useState('');
  const match = works.find((work) => work.hash === digest);
  async function verify(file?: File) {
    if (!file) return;
    setName(file.name); setStatus('hashing'); const result = await sha256(file); setDigest(result); setStatus(works.some((w) => w.hash === result) ? 'match' : 'none');
  }
  return (
    <div className="content-wrap verify-wrap">
      <PageHeading eyebrow="Independent verification" title="Verify a work" copy="Check whether a file matches an existing Authivara evidence record. The file is fingerprinted locally and is not uploaded." />
      <section className="verify-card">
        {status === 'idle' && <><div className="verify-icon"><ShieldCheck size={30} /></div><h2>Check a file against the record</h2><p>Choose the exact file you received. Even a one-pixel or one-character change produces a different fingerprint.</p><button className="verify-drop" onClick={() => inputRef.current?.click()}><UploadCloud size={24} /><strong>Choose a file to verify</strong><span>Private · local SHA-256 fingerprinting</span></button></>}
        {status === 'hashing' && <div className="verify-loading"><span className="spinner large" /><h2>Creating a local fingerprint</h2><p>Checking {name} without uploading it…</p></div>}
        {status === 'match' && match && <div className="match-result"><div className="match-seal"><Check size={32} /></div><span className="eyebrow">Exact fingerprint match</span><h2>This file matches a registered proof</h2><p>The bytes in <strong>{name}</strong> correspond exactly to the fingerprint recorded below.</p><div className="match-work"><WorkIcon work={match} large /><div><strong>{match.title}</strong><span>{match.certificateId}</span></div><span className="status-pill"><Check size={12} /> Anchored</span></div><div className="result-caveat"><Scale size={18} /><p>A match verifies file integrity and the existence record. It does not, by itself, resolve authorship disputes or determine legal ownership.</p></div><div className="success-actions"><button className="secondary" onClick={() => { setStatus('idle'); setDigest(''); }}>Verify another</button><button className="primary" onClick={() => onOpen(match)}>View proof <ArrowRight size={16} /></button></div></div>}
        {status === 'none' && <div className="match-result no-match"><div className="no-match-seal"><Search size={27} /></div><span className="eyebrow">No exact match found</span><h2>This fingerprint is not in this workspace</h2><p>That does not mean the file is unauthentic or unowned—only that we could not match this exact file to an available record.</p><div className="hash-result compact-result"><div><Fingerprint size={18} /><span><small>Calculated fingerprint</small><code>{shortenHash(digest, 14, 12)}</code></span></div></div><button className="secondary" onClick={() => { setStatus('idle'); setDigest(''); }}>Try another file</button></div>}
        <input ref={inputRef} hidden type="file" onChange={(e) => verify(e.target.files?.[0])} />
      </section>
      <section className="verification-facts"><div><LockKeyhole size={18} /><strong>Private by design</strong><p>Your original file stays in your browser.</p></div><div><Fingerprint size={18} /><strong>Byte-for-byte check</strong><p>Verification compares exact SHA-256 fingerprints.</p></div><div><Scale size={18} /><strong>Evidence, not adjudication</strong><p>A result does not determine legal ownership.</p></div></section>
    </div>
  );
}

function ProvenancePage({ works, onOpen }: { works: ProofWork[]; onOpen: (w: ProofWork) => void }) {
  return <div className="content-wrap"><PageHeading title="Provenance" copy="Follow version history and rights events across your creative portfolio." actions={<button className="secondary"><Download size={16} /> Export history</button>} /><section className="panel provenance-panel"><div className="panel-heading"><div><h3>Evidence timeline</h3><p>Chronological, attributable events from your workspace</p></div><span className="status-pill"><Activity size={12} /> Live record</span></div><div className="timeline">{works.map((work, index) => <button key={work.id} className="timeline-event" onClick={() => onOpen(work)}><span className="timeline-line"><i>{index === 0 ? <Sparkles size={15} /> : <Fingerprint size={15} />}</i></span><div><small>{new Date(work.registeredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</small><h3>{index === 0 ? 'Latest proof anchored' : 'Evidence record created'}</h3><p><strong>{work.title}</strong> · Version {work.version} · submitted by {work.creator}</p><code>{shortenHash(work.hash, 12, 10)}</code></div><ChevronRight size={18} /></button>)}</div></section></div>;
}

function SimplePage({ page }: { page: Page }) {
  const configs: Record<string, { icon: typeof Home; title: string; copy: string; action: string }> = {
    Licences: { icon: ReceiptText, title: 'Licences', copy: 'Create clear, connected records of how your registered works may be used.', action: 'Create licence record' },
    Team: { icon: Users, title: 'Team workspace', copy: 'Manage creators, reviewers, and proof administrators with role-based access.', action: 'Invite team member' },
    'API & integrations': { icon: Code2, title: 'API & integrations', copy: 'Register and verify provenance from your publishing or production workflow.', action: 'Create API key' },
    Settings: { icon: Settings, title: 'Workspace settings', copy: 'Control identity, privacy, notifications, billing, and proof preferences.', action: 'Save changes' },
  };
  const item = configs[page]; const Icon = item.icon;
  return <div className="content-wrap"><PageHeading title={item.title} copy={item.copy} actions={<button className="primary"><Plus size={16} /> {item.action}</button>} /><section className="panel coming-panel"><div className="coming-icon"><Icon size={28} /></div><span className="eyebrow">Product preview</span><h2>{item.title} is ready for your next workflow</h2><p>This foundation separates provenance evidence from contractual rights. Production connections require your organisation’s identity, policy, and chain-provider configuration.</p><div className="coming-features"><span><Check size={14} /> Role-aware access</span><span><Check size={14} /> Immutable audit events</span><span><Check size={14} /> Exportable records</span></div><button className="secondary">Read the implementation guide <ArrowRight size={15} /></button></section></div>;
}

function AiMetadataBadge({ origin }: { origin: AiMetadata['origin'] }) {
  const labels: Record<string, string> = {
    HUMAN_CREATED: 'Human created', AI_ASSISTED: 'AI assisted', AI_GENERATED: 'AI generated', AI_EDITED: 'AI edited', UNKNOWN: 'Unknown origin',
  };
  const tones: Record<string, string> = { HUMAN_CREATED: 'mint', AI_ASSISTED: 'blue', AI_GENERATED: 'gold', AI_EDITED: 'purple', UNKNOWN: 'muted' };
  return <span className={`status-pill ${tones[origin] ?? ''}`}><Sparkles size={12} /> {labels[origin] ?? origin}</span>;
}

function DetailDrawer({ work, onClose, toast }: { work: ProofWork; onClose: () => void; toast: (message: string) => void }) {
  const [aiMeta, setAiMeta] = useState<AiMetadata | null>(null);
  useEffect(() => {
    if (apiEnabled && work.id) getAiMetadata(work.id).then((r) => setAiMeta(r.aiMetadata)).catch(() => {});
  }, [work.id]);
  async function downloadCertificate() {
    if (apiEnabled) {
      try {
        const blob = await downloadCertificatePdf(work.certificateId);
        const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${work.certificateId}.pdf`; link.click(); URL.revokeObjectURL(url); toast('Certificate PDF downloaded');
      } catch (error) { toast(error instanceof Error ? error.message : 'Certificate download failed'); }
      return;
    }
    const payload = { schema: 'authivara-proof/v1', evidence_notice: 'Evidence of file existence and provenance; not a legal ownership judgment.', proof: work };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${work.certificateId}.json`; link.click(); URL.revokeObjectURL(url); toast('Certificate downloaded');
  }
  async function shareProof() {
    try {
      const link = apiEnabled ? (await createShareLink(work.certificateId)).publicVerificationUrl : `${window.location.origin}/verify?hash=${work.hash}`;
      await navigator.clipboard.writeText(link); toast('Verification link copied');
    } catch (error) { toast(error instanceof Error ? error.message : 'Unable to create verification link'); }
  }
  return <><button className="drawer-scrim" onClick={onClose} aria-label="Close proof details" /><aside className="detail-drawer"><div className="drawer-head"><span>Proof details</span><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="drawer-content"><div className="proof-title"><WorkIcon work={work} large /><span><small>{work.type} · Version {work.version}</small><h2>{work.title}</h2><p>{work.filename}</p></span></div><div className="anchor-state"><div className="anchor-check"><Check size={22} /></div><div><strong>Timestamp anchored</strong><span>{new Date(work.registeredAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}</span></div><span className="status-pill">Verified</span></div><dl className="detail-list"><div><dt>Certificate ID</dt><dd>{work.certificateId} <button onClick={() => { navigator.clipboard.writeText(work.certificateId); toast('Certificate ID copied'); }}><Copy size={14} /></button></dd></div><div><dt>Creator account</dt><dd>{work.creator} <BadgeCheck size={15} /></dd></div><div><dt>Fingerprint</dt><dd className="stacked"><code>{work.hash}</code><button onClick={() => { navigator.clipboard.writeText(work.hash); toast('Fingerprint copied'); }}><Copy size={14} /> Copy fingerprint</button></dd></div><div><dt>Anchoring network</dt><dd>{work.network}</dd></div><div><dt>Anchor reference</dt><dd className="stacked"><code>{shortenHash(work.anchorId, 14, 12)}</code><button><ExternalLink size={14} /> View record</button></dd></div></dl>{aiMeta && <div className="ai-metadata-section"><div className="ai-meta-header"><Sparkles size={15} /><span>AI Content Provenance</span><AiMetadataBadge origin={aiMeta.origin} /></div><dl className="detail-list"><div><dt>Disclosure</dt><dd>Creator-provided information</dd></div>{aiMeta.toolName && <div><dt>AI Tool</dt><dd>{aiMeta.toolName}</dd></div>}{aiMeta.modelName && <div><dt>Model</dt><dd>{aiMeta.modelName}</dd></div>}{aiMeta.creationNotes && <div><dt>Creation notes</dt><dd>{aiMeta.creationNotes}</dd></div>}{aiMeta.editingNotes && <div><dt>Editing notes</dt><dd>{aiMeta.editingNotes}</dd></div>}{aiMeta.humanContributionNotes && <div><dt>Human contribution</dt><dd>{aiMeta.humanContributionNotes}</dd></div>}</dl></div>}<div className="legal-boundary"><Scale size={18} /><div><strong>Scope of this proof</strong><p>This record supports verification that the specified fingerprint existed at this time and was submitted by this account. It does not automatically establish copyright ownership, licensing permission, or legal enforceability.</p></div></div>{work.note && <div className="proof-note"><small>Private note</small><p>{work.note}</p></div>}</div><div className="drawer-actions"><button className="secondary" onClick={downloadCertificate}><Download size={16} /> Download</button><button className="primary" onClick={shareProof}><Share2 size={16} /> Share proof</button></div></aside></>;
}

function VersionHistoryDrawer({ work, onClose }: { work: ProofWork; onClose: () => void }) {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(work.version);
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!apiEnabled) {
      setVersions([{ id: work.id, versionNumber: work.version, label: work.version === 1 ? 'Initial' : null, hash: work.hash, hashAlgorithm: 'SHA-256', fileName: work.filename, mimeType: work.type, fileSize: work.fileSize, description: work.note ?? null, tags: work.tags ?? [], createdAt: work.registeredAt, creator: { id: 'local', name: work.creator, username: 'creator' }, proof: null }]);
      setLoading(false); return;
    }
    getContentVersions(work.id).then((items) => {
      if (!active) return; setVersions(items); setFrom(items.at(-1)?.versionNumber ?? 1); setTo(items[0]?.versionNumber ?? 1);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Versions could not be loaded'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [work]);
  async function compare() {
    if (!apiEnabled) { setError('Add another registered version to compare metadata.'); return; }
    setError('');
    try { setComparison(await compareContentVersions(work.id, from, to)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Versions could not be compared'); }
  }
  return <><button className="drawer-scrim" onClick={onClose} aria-label="Close version history" /><aside className="detail-drawer version-drawer"><div className="drawer-head"><span>Version history</span><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="drawer-content"><div className="proof-title"><WorkIcon work={work} large /><span><small>Git-style provenance</small><h2>{work.title}</h2><p>Every version has its own exact-byte fingerprint.</p></span></div>
    {loading ? <div className="verify-loading"><span className="spinner" /> Loading versions…</div> : <div className="version-tree">{versions.map((version) => <article key={version.id}><span className="version-node"><i /><b>v{version.versionNumber}</b></span><div><strong>{version.label || (version.versionNumber === 1 ? 'Initial' : `Version ${version.versionNumber}`)}</strong><p>{version.fileName} · {formatBytes(version.fileSize)}</p><code>{shortenHash(version.hash, 14, 10)}</code><small>{new Date(version.createdAt).toLocaleString('en-GB')} · {version.creator.name}</small><span className="status-pill">{version.proof?.status ?? 'Local record'}</span></div></article>)}</div>}
    <section className="version-compare"><h3>Compare version metadata</h3><div><label>From<select value={from} onChange={(event) => setFrom(Number(event.target.value))}>{versions.map((version) => <option key={version.id} value={version.versionNumber}>v{version.versionNumber}</option>)}</select></label><label>To<select value={to} onChange={(event) => setTo(Number(event.target.value))}>{versions.map((version) => <option key={version.id} value={version.versionNumber}>v{version.versionNumber}</option>)}</select></label><button className="secondary" onClick={compare} disabled={versions.length < 2}>Compare</button></div>
      {comparison && <div className={`comparison-result ${comparison.comparison.exactBytesEqual ? 'match' : 'different'}`}><strong>{comparison.comparison.exactBytesEqual ? 'Exact byte match' : 'Different file bytes'}</strong><p>{comparison.comparison.notice}</p><small>Metadata changed: {comparison.comparison.metadataDifferences.join(', ') || 'none'}</small></div>}
      {error && <p className="file-error">{error}</p>}
    </section>
    <div className="scope-callout"><Scale size={18} /><p>Visual or metadata similarity does not establish cryptographic equivalence. Only matching SHA-256 fingerprints establish that the exact file bytes match.</p></div>
  </div></aside></>;
}

function apiContentToWork(content: ApiContent): ProofWork {
  const type = categoryWorkType(content.category);
  return {
    id: content.id,
    title: content.title,
    type,
    category: content.category,
    tags: content.tags ?? [],
    filename: content.fileName,
    fileSize: content.fileSize,
    hash: content.contentHash,
    algorithm: 'SHA-256',
    registeredAt: content.proof?.timestamp ?? content.createdAt,
    status: content.proof?.status === 'CONFIRMED' ? 'Anchored' : 'Pending',
    certificateId: content.certificate?.certificateNumber ?? 'Pending',
    anchorId: content.proof?.transactionHash ?? content.proof?.proofId ?? 'Pending',
    network: content.proof?.network ?? 'Pending submission',
    version: content.versionNumber,
    creator: 'Your creator profile',
    note: content.description ?? undefined,
    color: '#60a593',
  };
}

export default function App() {
  const [page, setPage] = useState<Page>('Overview');
  const [registering, setRegistering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [works, setWorks] = useState<ProofWork[]>(() => apiEnabled ? [] : loadWorks());
  const [apiReady, setApiReady] = useState(!apiEnabled);
  const [selected, setSelected] = useState<ProofWork | null>(null);
  const [versionWork, setVersionWork] = useState<ProofWork | null>(null);
  const [summary, setSummary] = useState<DashboardSummary>({ totalWorks: 0, verifiedWorks: 0, pendingProofs: 0, licensedWorks: 0, verificationRequests: 0, storageUsageBytes: 0 });
  const [toastMessage, setToastMessage] = useState('');
  const orderedWorks = useMemo(() => [...works].sort((a, b) => +new Date(b.registeredAt) - +new Date(a.registeredAt)), [works]);
  const dashboardSummary = apiEnabled ? summary : {
    totalWorks: works.length, verifiedWorks: works.filter((work) => work.status === 'Anchored').length,
    pendingProofs: works.filter((work) => work.status === 'Pending').length, licensedWorks: 0,
    verificationRequests: 0, storageUsageBytes: works.reduce((total, work) => total + work.fileSize, 0),
  };
  useEffect(() => { if (!apiEnabled) saveWorks(works); }, [works]);
  useEffect(() => {
    if (!apiEnabled) return;
    let active = true;
    currentUser()
      .then(() => Promise.all([listContent(), getDashboardSummary()]))
      .then(([content, totals]) => { if (active) { setWorks(content.map(apiContentToWork)); setSummary(totals); } })
      .catch((error: Error & { status?: number }) => {
        if (error.status === 401) window.location.assign('/signup');
        else if (active) setToastMessage(error.message);
      })
      .finally(() => { if (active) setApiReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (!toastMessage) return; const timer = window.setTimeout(() => setToastMessage(''), 2600); return () => clearTimeout(timer); }, [toastMessage]);
  async function completeProof(work: ProofWork, file: File, onUploadProgress: (fraction: number) => void, metadata: { visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC'; category: string; tags: string[] }): Promise<ProofWork> {
    let issued = work;
    let completionMessage = 'Proof created successfully';
    if (apiEnabled) {
      const result = await registerFile({ file, clientHash: work.hash, title: work.title, description: work.note, category: metadata.category, tags: metadata.tags, visibility: metadata.visibility, onUploadProgress });
      issued = {
        ...work,
        id: result.content.id,
        registeredAt: result.content.createdAt,
        status: result.proof.status === 'CONFIRMED' ? 'Anchored' : 'Pending',
        certificateId: result.certificate.certificateNumber,
        anchorId: result.proof.transactionHash ?? result.proof.proofId,
        network: result.proof.blockchainNetwork,
      };
      if (result.duplicateNotice) completionMessage = result.duplicateNotice.message;
      getDashboardSummary().then(setSummary).catch(() => undefined);
    }
    setWorks((current) => [issued, ...current]); setToastMessage(completionMessage);
    return issued;
  }
  async function archiveWork(work: ProofWork) {
    if (!window.confirm(`Archive “${work.title}”? Its public proof history remains auditable.`)) return;
    try {
      if (apiEnabled) await archiveContent(work.id);
      setWorks((current) => current.filter((item) => item.id !== work.id));
      if (apiEnabled) getDashboardSummary().then(setSummary).catch(() => undefined);
      setToastMessage(`${work.title} archived`);
    } catch (error) { setToastMessage(error instanceof Error ? error.message : 'Work could not be archived'); }
  }
  if (!apiReady) return <div className="app-loading"><span className="spinner large" /><p>Loading your secure workspace…</p></div>;
  if (registering) return <RegisterPage works={works} onComplete={completeProof} onCancel={() => { setRegistering(false); setPage('My works'); }} />;
  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} open={menuOpen} close={() => setMenuOpen(false)} workCount={works.length} />
      <main className="main-shell">
        <Topbar title={page} openMenu={() => setMenuOpen(true)} onRegister={() => setRegistering(true)} />
        {page === 'Overview' && <Overview works={orderedWorks} summary={dashboardSummary} setPage={setPage} onRegister={() => setRegistering(true)} onOpen={setSelected} />}
        {page === 'My works' && <WorksPage works={orderedWorks} onRegister={() => setRegistering(true)} onOpen={setSelected} onHistory={setVersionWork} onArchive={archiveWork} setPage={setPage} toast={setToastMessage} />}
        {page === 'Verify a work' && <VerifyPage works={orderedWorks} onOpen={setSelected} />}
        {page === 'Provenance' && <ProvenancePage works={orderedWorks} onOpen={setSelected} />}
        {['Licences', 'Team', 'API & integrations', 'Settings'].includes(page) && <SimplePage page={page} />}
      </main>
      {selected && <DetailDrawer work={selected} onClose={() => setSelected(null)} toast={setToastMessage} />}
      {versionWork && <VersionHistoryDrawer work={versionWork} onClose={() => setVersionWork(null)} />}
      {toastMessage && <div className="toast"><Check size={16} /> {toastMessage}</div>}
    </div>
  );
}
