'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint } from 'lucide-react';
import { verifyMagicLink } from '@/src/api/client';

export default function MagicLinkExchange({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!token) { setError('This sign-in link is incomplete.'); return; }
    verifyMagicLink(token).then(() => { router.replace('/'); router.refresh(); })
      .catch((cause: Error) => setError(cause.message));
  }, [router, token]);
  return <main className="public-verify-shell"><section className="public-verify-card">
    <div className="public-brand"><Fingerprint size={22} /> authivara</div>
    {error ? <><h1>Unable to sign in</h1><p>{error}</p><a className="primary" href="/signup">Return to sign in</a></> : <div className="verify-loading"><span className="spinner large" /><h2>Securing your session…</h2><p>This single-use link is being verified.</p></div>}
  </section></main>;
}
