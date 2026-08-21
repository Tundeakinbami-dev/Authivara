export declare function sha256(value: string | Buffer): string;
export declare function randomToken(bytes?: number): string;
export declare function randomProofId(): string;
export declare function privacyHash(value: string, secret: string): string;
export declare function canonicalJson(value: unknown): string;
