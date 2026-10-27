import { type PrismaClient } from '@prisma/client';
import type { AppConfig } from '../../config.js';
import { AuditService } from '../audit/audit.service.js';
import type { EmailSender } from './email-sender.js';
import type { GoogleIdentityVerifier } from './google-identity.js';
export interface SignUpInput {
    email: string;
    password: string;
    name: string;
    username: string;
    displayName: string;
    country?: string;
}
export interface RequestFingerprint {
    ip?: string;
    userAgent?: string;
}
export declare class AuthService {
    private readonly database;
    private readonly audit;
    private readonly config;
    private readonly emailSender;
    private readonly googleVerifier?;
    constructor(database: PrismaClient, audit: AuditService, config: AppConfig, emailSender: EmailSender, googleVerifier?: GoogleIdentityVerifier | undefined);
    signUp(input: SignUpInput, fingerprint: RequestFingerprint): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            username: string;
            emailVerified: boolean;
            mfaEnabled: boolean;
        };
        sessionToken: string;
    }>;
    login(emailInput: string, password: string, fingerprint: RequestFingerprint): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            username: string;
            emailVerified: boolean;
            mfaEnabled: boolean;
        };
        sessionToken: string;
    }>;
    authenticate(rawToken?: string): Promise<{
        id: string;
        email: string;
        emailVerifiedAt: Date | null;
    } | null>;
    logout(rawToken: string | undefined): Promise<void>;
    requestMagicLink(emailInput: string): Promise<{
        developmentMagicLink?: string;
    }>;
    loginWithMagicLink(token: string, fingerprint: RequestFingerprint): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            username: string;
            emailVerified: boolean;
            mfaEnabled: boolean;
        };
        sessionToken: string;
    }>;
    loginWithGoogle(idToken: string, fingerprint: RequestFingerprint): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            username: string;
            emailVerified: boolean;
            mfaEnabled: boolean;
        };
        sessionToken: string;
    }>;
    private createSession;
    private publicUser;
}
