'use client';

import { useRef, useState } from 'react';
import { Check, Fingerprint, Search, UploadCloud } from 'lucide-react';
import { verifyPublicFile } from '@/src/api/client';
import { sha256 } from '@/src/crypto';

type PublicResult = Awaited<ReturnType<typeof verifyPublicFile>>;

export default function VerificationEngine({ expected }: { expected: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [proofReference, setProofReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'ready' | 'hashing' | 'done'>('ready');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<PublicResult | null>(null);

  function proofIdFromReference(value: string): string | undefined {
    const match = value.trim().toUpperCase().match(/PCA-[A-Z0-9]{8,24}/);
    return match?.[0];
  }

  async function verify() {
    if (!file) { input.current?.click(); return; }
    setStatus('hashing'); setProgress(0); setResult(null);
    const digest = await sha256(file, setProgress);
    if (expected) {
      setResult({
        result: digest === expected ? 'MATCH' : 'NO_MATCH', exactMatch: digest === expected, anchorVerified: false,
        notice: digest === expected ? 'The uploaded file matches this browser-only sandbox fingerprint.' : 'No matching sandbox proof was found.',
      });
    } else {
      const referenceProvided = proofReference.trim().length > 0;
      const proofId = proofIdFromReference(proofReference);
      setResult(referenceProvided && !proofId
        ? { result: 'INVALID_PROOF', exactMatch: false, anchorVerified: false, notice: 'The proof ID or verification URL is invalid.' }
        : await verifyPublicFile(digest, proofId));
    }
    setStatus('done');
  }

  const labels = {
    MATCH: '✓ Verified Match',
    NO_MATCH: '✕ No Matching Proof Found',
    RELATED_VERSION: '⚠ Related Work Found',
    INVALID_PROOF: '✕ Proof could not be validated',
    REVOKED: '✕ Proof revoked',
  } as const;

  return <main className="public-verify-shell"><section className="public-verify-card verification-engine-card">
    <div className="public-brand"><Fingerprint size={22} /> authivara</div>
    <span className="eyebrow">Verification engine</span><h1>Verify a work</h1><p>Upload the exact file and optionally enter a proof ID or `/proof/PCA-…` verification URL. SHA-256 is calculated locally.</p>
    {!expected && <label className="verification-reference"><span>Proof ID or verification URL <em>Optional</em></span><input value={proofReference} onChange={(event) => setProofReference(event.target.value)} placeholder="PCA-XXXXXXXXXXXX or https://…/proof/PCA-…" /></label>}
    <button className="verify-drop" onClick={() => input.current?.click()}><UploadCloud size={24} /><strong>{file ? file.name : 'Choose file to verify'}</strong><span>{file ? `${file.size.toLocaleString()} bytes` : 'Original bytes stay on your device'}</span></button>
    <button className="primary verification-submit" disabled={!file || status === 'hashing'} onClick={verify}>{status === 'hashing' ? `Hashing ${Math.round(progress * 100)}%…` : 'Verify cryptographic fingerprint'}</button>
    {status === 'hashing' && <div className="hash-progress"><span style={{ width: `${progress * 100}%` }} /></div>}
    {status === 'done' && result && <div className={`engine-result ${result.result.toLowerCase()}`}>
      <div className={result.result === 'MATCH' ? 'match-seal' : 'no-match-seal'}>{result.result === 'MATCH' ? <Check size={30} /> : <Search size={25} />}</div>
      <h2>{labels[result.result]}</h2><p>{result.notice}</p>
      {result.relatedVersion && <small>Matched version {result.relatedVersion.versionNumber} · {result.relatedVersion.proofId ?? 'proof pending'}</small>}
      {result.proof && <a className="secondary" href={`/proof/${result.proof.proofId}`}>View {result.proof.proofId}</a>}
      <button className="auth-switch" onClick={() => { setFile(null); setResult(null); setStatus('ready'); if (input.current) input.current.value = ''; }}>Verify another file</button>
    </div>}
    <input ref={input} hidden type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); setStatus('ready'); }} />
  </section></main>;
}
