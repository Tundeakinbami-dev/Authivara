import PublicProofPage from './public-proof';

export default async function ProofPage({ params }: { params: Promise<{ proofId: string }> }) {
  const { proofId } = await params;
  return <PublicProofPage proofId={proofId.toUpperCase()} />;
}
