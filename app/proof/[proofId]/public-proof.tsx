'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Copy, Download, ExternalLink, Fingerprint, Search, Share2, UploadCloud } from 'lucide-react';
import { downloadPublicCertificatePdf, getPublicProof, verifyPublicFile, type PublicProof, type TimelineEvent } from '@/src/api/client';
import { sha256, shortenHash } from '@/src/crypto';

type VerifyResult = Awaited<ReturnType<typeof verifyPublicFile>>;

export default function PublicProofPage({ proofId }: { proofId: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState<PublicProof | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [anchorVerified, setAnchorVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    getPublicProof(proofId).then((data) => { setProof(data.proof); setTimeline(data.timeline); setAnchorVerified(data.anchorVerified); })
      .catch((cause: Error) => setError(cause.message)).finally(() => setLoading(false));
  }, [proofId]);

  async function verify(file?: File) {
    if (!file) return;
    setResult(null); setProgress(0);
    try {
      const digest = await sha256(file, setProgress);
      setResult(await verifyPublicFile(digest, proofId));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Verification failed.'); }
  }

  async function downloadCertificate() {
    if (!proof) return;
    const blob = await downloadPublicCertificatePdf(proof.proofId);
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `${proof.certificate?.certificateNumber ?? proof.proofId}.pdf`; link.click(); URL.revokeObjectURL(url);
  }

  if (loading) return <main className="public-verify-shell"><span className="spinner large" /></main>;
  if (error || !proof) return <main className="public-verify-shell"><section className="public-verify-card"><div className="no-match-seal"><Search size={27} /></div><h1>Proof unavailable</h1><p>{error || 'This proof could not be validated.'}</p></section></main>;

  const verified = proof.status === 'CONFIRMED' && anchorVerified;
  return <main className="proof-page-shell">
    <header className="proof-public-header"><a href="/" className="public-brand"><Fingerprint size={22} /> authivara</a><span>Independent public record</span></header>
    <section className="proof-hero">
      <div className={`proof-public-seal ${verified ? '' : 'pending'}`}>{verified ? <Check size={34} /> : <Fingerprint size={34} />}</div>
      <span className="eyebrow">Proof of Content Authorship</span>
      <h1>{proof.content.title}</h1>
      <p>{proof.content.type}</p>
      <span className={`proof-public-status ${verified ? '' : 'pending'}`}>{verified ? '✓ Verified' : proof.status}</span>
    </section>
    <div className="proof-public-grid">
      <section className="proof-public-panel">
        <h2>Cryptographic record</h2>
        <dl className="proof-public-details">
          <div><dt>Registered</dt><dd>{new Date(proof.registeredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
          <div><dt>Proof ID</dt><dd><code>{proof.proofId}</code><button onClick={() => navigator.clipboard.writeText(proof.proofId)} aria-label="Copy proof ID"><Copy size={14} /></button></dd></div>
          <div><dt>Hash algorithm</dt><dd>SHA-256 <small>canonical file bytes</small></dd></div>
          <div><dt>Content fingerprint</dt><dd><code>{shortenHash(proof.contentHash, 16, 14)}</code></dd></div>
          <div><dt>Blockchain</dt><dd>{proof.blockchain}</dd></div>
          <div><dt>Transaction</dt><dd><code>{proof.transactionHash ? shortenHash(proof.transactionHash, 14, 12) : 'Pending'}</code></dd></div>
          <div><dt>Verification</dt><dd className={anchorVerified ? 'verified-copy' : ''}>{anchorVerified ? '✓ Cryptographic proof validated' : 'Anchor validation pending'}</dd></div>
        </dl>
        <div className="proof-public-actions">
          <button className="secondary" onClick={() => navigator.clipboard.writeText(proof.proofId)}><Copy size={15} /> Copy proof ID</button>
          <button className="secondary" onClick={downloadCertificate}><Download size={15} /> Download certificate</button>
          <button className="secondary" onClick={() => navigator.clipboard.writeText(window.location.href)}><Share2 size={15} /> Share proof</button>
          {proof.blockchainUrl && <a className="secondary" href={proof.blockchainUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> View blockchain record</a>}
        </div>
      </section>
      <aside className="proof-verify-panel">
        <UploadCloud size={25} /><h2>Verify your copy</h2><p>Hash a file locally and compare it with this proof. The original file never leaves your device.</p>
        <button className="primary" onClick={() => fileInput.current?.click()}>Choose file <ArrowRight size={15} /></button>
        {progress > 0 && progress < 1 && <div className="hash-progress"><span style={{ width: `${progress * 100}%` }} /><small>Hashing {Math.round(progress * 100)}%</small></div>}
        {result && <div className={`inline-verify-result ${result.result.toLowerCase()}`}><strong>{result.result === 'MATCH' ? '✓ Verified Match' : result.result === 'RELATED_VERSION' ? '⚠ Related Work Found' : result.result === 'INVALID_PROOF' ? '✕ Invalid proof' : '✕ No Matching Proof Found'}</strong><p>{result.notice}</p>{result.relatedVersion && <small>Version {result.relatedVersion.versionNumber} · {result.relatedVersion.proofId}</small>}<button onClick={() => { setResult(null); fileInput.current?.click(); }}>Verify another file</button></div>}
        <input ref={fileInput} hidden type="file" onChange={(event) => verify(event.target.files?.[0])} />
      </aside>
    </div>
    <section className="proof-timeline-section"><span className="eyebrow">Provenance timeline</span><h2>History of this work</h2><div className="public-timeline">{timeline.map((event, index) => <article key={`${event.type}-${event.timestamp}-${index}`}><i>{event.type === 'BLOCKCHAIN_CONFIRMED' ? <Check size={14} /> : <Fingerprint size={14} />}</i><time>{new Date(event.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time><h3>{event.title}</h3><p>{event.detail}</p></article>)}</div></section>
    <footer className="proof-privacy-footer">The original private file is not displayed or stored on a public blockchain. This page contains only the minimum proof information required for independent verification.</footer>
  </main>;
}
