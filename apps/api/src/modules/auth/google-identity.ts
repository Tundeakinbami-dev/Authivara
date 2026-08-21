import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppError, UnauthorizedError } from '../../shared/errors.js';

export interface GoogleIdentity {
  subject: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface GoogleIdentityVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

export class GoogleOidcVerifier implements GoogleIdentityVerifier {
  private readonly keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

  constructor(private readonly clientId: string) {}

  async verify(idToken: string): Promise<GoogleIdentity> {
    try {
      const { payload } = await jwtVerify(idToken, this.keys, {
        audience: this.clientId,
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
      });
      if (!payload.sub || typeof payload.email !== 'string' || payload.email_verified !== true) {
        throw new UnauthorizedError('Google account email is not verified');
      }
      return {
        subject: payload.sub,
        email: payload.email.toLowerCase(),
        name: typeof payload.name === 'string' ? payload.name : payload.email.split('@')[0]!,
        avatarUrl: typeof payload.picture === 'string' ? payload.picture : undefined,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new AppError('Google identity token is invalid', 401, 'INVALID_GOOGLE_TOKEN');
    }
  }
}
