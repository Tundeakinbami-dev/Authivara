import DemoVerification from './demo-verification';

export default async function DemoVerificationPage({ searchParams }: { searchParams: Promise<{ hash?: string }> }) {
  const { hash } = await searchParams;
  return <DemoVerification expected={hash ?? ''} />;
}
