export interface GoogleIdentity {
    subject: string;
    email: string;
    name: string;
    avatarUrl?: string;
}
export interface GoogleIdentityVerifier {
    verify(idToken: string): Promise<GoogleIdentity>;
}
export declare class GoogleOidcVerifier implements GoogleIdentityVerifier {
    private readonly clientId;
    private readonly keys;
    constructor(clientId: string);
    verify(idToken: string): Promise<GoogleIdentity>;
}
