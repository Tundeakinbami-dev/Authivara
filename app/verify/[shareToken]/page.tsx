import SharedVerification from './shared-verification';

export default async function SharedVerificationPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  return <SharedVerification shareToken={shareToken} />;
}
