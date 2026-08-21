'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, LockKeyhole, ShieldCheck } from 'lucide-react';
import { login, signUp } from '@/src/api/client';

export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      if (mode === 'signup') {
        await signUp({
          email: String(data.get('email')), password: String(data.get('password')),
          name: String(data.get('name')), username: String(data.get('username')),
          displayName: String(data.get('displayName')), country: String(data.get('country') || '') || undefined,
        });
      } else {
        await login({ email: String(data.get('email')), password: String(data.get('password')) });
      }
      router.push('/'); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally { setSubmitting(false); }
  }

  return <main className="auth-shell">
    <section className="auth-context">
      <div className="brand"><span className="brand-mark"><Fingerprint size={23} /></span><span>authivara</span></div>
      <div><span className="eyebrow">Privacy-first provenance</span><h1>Protect the evidence.<br />Keep the work private.</h1><p>Create byte-for-byte proof without placing your original content or private metadata on a public blockchain.</p></div>
      <div className="auth-trust"><span><ShieldCheck size={17} /> Encrypted private storage</span><span><Fingerprint size={17} /> Independent SHA-256 checks</span><span><LockKeyhole size={17} /> Minimum on-chain data</span></div>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <span className="eyebrow">{mode === 'signup' ? 'Create your workspace' : 'Welcome back'}</span>
        <h2>{mode === 'signup' ? 'Start your creator record' : 'Sign in to Authivara'}</h2>
        <p>{mode === 'signup' ? 'Your creator profile and private workspace are created together.' : 'Continue managing your proofs and certificates.'}</p>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <>
            <label className="field"><span>Full name</span><input name="name" required minLength={2} autoComplete="name" /></label>
            <label className="field"><span>Creator display name</span><input name="displayName" required minLength={2} /></label>
            <label className="field"><span>Username</span><input name="username" required minLength={3} pattern="[A-Za-z0-9_]+" autoComplete="username" /></label>
            <label className="field"><span>Country code <em>Optional</em></span><input name="country" maxLength={2} placeholder="NG" /></label>
          </>}
          <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="email" /></label>
          <label className="field"><span>Password</span><input name="password" type="password" required minLength={mode === 'signup' ? 12 : 1} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
          {error && <p className="file-error" role="alert">{error}</p>}
          <button className="primary auth-submit" disabled={submitting}>{submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
        </form>
        <button className="auth-switch" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}>{mode === 'signup' ? 'Already have an account? Sign in' : 'New to Authivara? Create an account'}</button>
      </div>
    </section>
  </main>;
}
