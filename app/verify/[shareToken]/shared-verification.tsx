'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Fingerprint, Search, ShieldCheck, UploadCloud } from 'lucide-react';
import { inspectSharedProof, verifySharedProof, type PublicCertificate } from '@/src/api/client';
import { sha256 } from '@/src/crypto';

export default function SharedVerification({ shareToken }: { shareToken: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [certificate, setCertificate] = useState<PublicCertificate | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'hashing' | 'match' | 'none' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [anchorVerified, setAnchorVerified] = useState(false);

  useEffect(() => {
    inspectSharedProof(shareToken).then(({ certificate: proof }) => { setCertificate(proof); setStatus('ready'); })
      .catch((error: Error) => { setMessage(error.message); setStatus('error'); });
  }, [shareToken]);

  async function verify(file?: File) {
    if (!file) return;
    setStatus('hashing'); setProgress(0); setMessage('');
    try {
      const digest = await sha256(file, setProgress);
      const result = await verifySharedProof(shareToken, digest);
      setCertificate(result.certificate); setAnchorVerified(result.anchorVerified);
      setMessage(result.notice); setStatus(result.exactMatch ? 'match' : 'none');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Verification failed.'); setStatus('error'); }
  }

  return <main className="public-verify-shell"><section className="public-verify-card">
    <div className="public-brand"><Fingerprint size={22} /> authivara</div>
    {status === 'loading' && <div className="verify-loading"><span className="spinner large" /><h2>Loading proof…</h2></div>}
    {status === 'error' && <div className="match-result no-match"><div className="no-match-seal"><Search size={27} /></div><h2>Verification link unavailable</h2><p>{message}</p></div>}
    {status === 'ready' && certificate && <><div className="verify-icon"><ShieldCheck size={30} /></div><span className="eyebrow">Independent verification</span><h1>{certificate.content.title}</h1><p>Choose the exact file you received. It will be fingerprinted locally; the original bytes are not sent to Authivara.</p><button className="verify-drop" onClick={() => input.current?.click()}><UploadCloud size={24} /><strong>Choose file to verify</strong><span>Local SHA-256 · byte for byte</span></button></>}
    {status === 'hashing' && <div className="verify-loading"><span className="spinner large" /><h2>Fingerprinting locally</h2><p>{Math.round(progress * 100)}% complete</p></div>}
    {status === 'match' && certificate && <div className="match-result"><div className="match-seal"><Check size={32} /></div><span className="eyebrow">Exact fingerprint match</span><h2>This file matches the registered proof</h2><p>{certificate.content.title} · {certificate.certificateNumber}</p><div className="status-pill"><Check size={12} /> {anchorVerified ? 'Anchor independently checked' : `Proof ${certificate.proof.status.toLowerCase()}`}</div><p className="result-caveat">{message}</p></div>}
    {status === 'none' && <div className="match-result no-match"><div className="no-match-seal"><Search size={27} /></div><span className="eyebrow">No exact match</span><h2>This is not the registered byte sequence</h2><p>{message}</p></div>}
    <input ref={input} hidden type="file" onChange={(event) => verify(event.target.files?.[0])} />
  </section></main>;
}
