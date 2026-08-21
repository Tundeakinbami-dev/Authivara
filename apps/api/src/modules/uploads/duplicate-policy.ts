export interface DuplicateMatch {
  id: string;
  ownerId: string;
  organizationId: string | null;
  title: string;
  visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
  provenance: Array<{ proofId: string }>;
}

export function classifyDuplicate(matches: DuplicateMatch[], userId: string, organizationIds: string[]) {
  const own = matches.find((match) => match.ownerId === userId);
  if (own) return { type: 'SAME_USER' as const, contentId: own.id, title: own.title, message: 'You have already registered this exact file.' };
  const organization = matches.find((match) => match.organizationId && organizationIds.includes(match.organizationId));
  if (organization) return { type: 'SAME_ORGANIZATION' as const, contentId: organization.id, title: organization.title, message: 'This exact file is already registered in one of your organizations.' };
  const publiclyRegistered = matches.find((match) => match.visibility === 'PUBLIC' && match.provenance[0]);
  if (publiclyRegistered) {
    return {
      type: 'PUBLIC' as const,
      proofId: publiclyRegistered.provenance[0]!.proofId,
      title: publiclyRegistered.title,
      message: 'This exact file has previously been registered in a public proof.',
    };
  }
  // Cross-account private matches intentionally produce the same response as no database match.
  return { type: 'NONE' as const, message: 'No accessible duplicate registration was found.' };
}
