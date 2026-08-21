export interface DuplicateMatch {
    id: string;
    ownerId: string;
    organizationId: string | null;
    title: string;
    visibility: 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
    provenance: Array<{
        proofId: string;
    }>;
}
export declare function classifyDuplicate(matches: DuplicateMatch[], userId: string, organizationIds: string[]): {
    type: "SAME_USER";
    contentId: string;
    title: string;
    message: string;
    proofId?: undefined;
} | {
    type: "SAME_ORGANIZATION";
    contentId: string;
    title: string;
    message: string;
    proofId?: undefined;
} | {
    type: "PUBLIC";
    proofId: string;
    title: string;
    message: string;
    contentId?: undefined;
} | {
    type: "NONE";
    message: string;
    contentId?: undefined;
    title?: undefined;
    proofId?: undefined;
};
