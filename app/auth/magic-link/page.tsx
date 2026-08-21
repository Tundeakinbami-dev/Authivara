import MagicLinkExchange from './magic-link-exchange';

export default async function MagicLinkPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <MagicLinkExchange token={token ?? ''} />;
}
