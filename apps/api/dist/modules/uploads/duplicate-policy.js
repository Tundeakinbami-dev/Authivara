export function classifyDuplicate(matches, userId, organizationIds) {
    const own = matches.find((match) => match.ownerId === userId);
    if (own)
        return { type: 'SAME_USER', contentId: own.id, title: own.title, message: 'You have already registered this exact file.' };
    const organization = matches.find((match) => match.organizationId && organizationIds.includes(match.organizationId));
    if (organization)
        return { type: 'SAME_ORGANIZATION', contentId: organization.id, title: organization.title, message: 'This exact file is already registered in one of your organizations.' };
    const publiclyRegistered = matches.find((match) => match.visibility === 'PUBLIC' && match.provenance[0]);
    if (publiclyRegistered) {
        return {
            type: 'PUBLIC',
            proofId: publiclyRegistered.provenance[0].proofId,
            title: publiclyRegistered.title,
            message: 'This exact file has previously been registered in a public proof.',
        };
    }
    // Cross-account private matches intentionally produce the same response as no database match.
    return { type: 'NONE', message: 'No accessible duplicate registration was found.' };
}
