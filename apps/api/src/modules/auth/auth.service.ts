import { Prisma, type PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import type { AppConfig } from '../../config.js';
import { AuditService } from '../audit/audit.service.js';
import { ConflictError, UnauthorizedError } from '../../shared/errors.js';
import { privacyHash, randomToken, sha256 } from '../../shared/crypto.js';
import type { EmailSender } from './email-sender.js';
import type { GoogleIdentityVerifier } from './google-identity.js';
import { AppError } from '../../shared/errors.js';

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

export class AuthService {
  constructor(
    private readonly database: PrismaClient,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
    private readonly emailSender: EmailSender,
    private readonly googleVerifier?: GoogleIdentityVerifier,
  ) {}

  async signUp(input: SignUpInput, fingerprint: RequestFingerprint) {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim().toLowerCase();
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const slug = `${username}-${randomToken(5).toLowerCase()}`;
    try {
      const user = await this.database.$transaction(async (transaction) => {
        const created = await transaction.user.create({
          data: {
            email,
            name: input.name.trim(),
            username,
            passwordHash,
            creatorProfile: { create: { displayName: input.displayName.trim(), country: input.country } },
            authAccounts: { create: { provider: 'PASSWORD', providerAccountId: email } },
          },
        });
        const organization = await transaction.organization.create({
          data: {
            name: `${input.displayName.trim()} workspace`,
            slug,
            ownerId: created.id,
            members: { create: { userId: created.id, role: 'OWNER' } },
          },
        });
        await this.audit.append({ userId: created.id, organizationId: organization.id, action: 'USER_SIGNED_UP', resource: 'User', resourceId: created.id }, transaction);
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { user: this.publicUser(user), sessionToken: await this.createSession(user.id, fingerprint) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Email or username is already registered');
      }
      throw error;
    }
  }

  async login(emailInput: string, password: string, fingerprint: RequestFingerprint) {
    const user = await this.database.user.findUnique({ where: { email: emailInput.trim().toLowerCase() } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedError('Invalid email or password');
    }
    await this.audit.append({ userId: user.id, action: 'USER_LOGGED_IN', resource: 'Session' });
    return { user: this.publicUser(user), sessionToken: await this.createSession(user.id, fingerprint) };
  }

  async authenticate(rawToken?: string) {
    if (!rawToken) return null;
    const session = await this.database.session.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
    return { id: session.user.id, email: session.user.email };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.database.session.updateMany({ where: { tokenHash: sha256(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async requestMagicLink(emailInput: string): Promise<{ developmentMagicLink?: string }> {
    const email = emailInput.trim().toLowerCase();
    const user = await this.database.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return {};
    const token = randomToken();
    const expiresInMinutes = 15;
    await this.database.authToken.create({
      data: { userId: user.id, email, tokenHash: sha256(token), purpose: 'MAGIC_LINK_LOGIN', expiresAt: new Date(Date.now() + expiresInMinutes * 60_000) },
    });
    const actionUrl = `${this.config.APP_ORIGIN}/auth/magic-link?token=${encodeURIComponent(token)}`;
    await this.emailSender.sendMagicLink({ recipient: email, actionUrl, expiresInMinutes });
    return this.config.NODE_ENV === 'development' ? { developmentMagicLink: actionUrl } : {};
  }

  async loginWithMagicLink(token: string, fingerprint: RequestFingerprint) {
    const user = await this.database.$transaction(async (transaction) => {
      const authToken = await transaction.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
      if (!authToken?.user || authToken.usedAt || authToken.purpose !== 'MAGIC_LINK_LOGIN' || authToken.expiresAt <= new Date()) {
        throw new UnauthorizedError('Magic link is invalid or expired');
      }
      const consumed = await transaction.authToken.updateMany({
        where: { id: authToken.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw new UnauthorizedError('Magic link is invalid or expired');
      const updated = await transaction.user.update({ where: { id: authToken.user.id }, data: { emailVerifiedAt: authToken.user.emailVerifiedAt ?? new Date() } });
      await transaction.authAccount.upsert({
        where: { provider_providerAccountId: { provider: 'MAGIC_LINK', providerAccountId: updated.email } },
        create: { userId: updated.id, provider: 'MAGIC_LINK', providerAccountId: updated.email },
        update: { userId: updated.id },
      });
      await this.audit.append({ userId: updated.id, action: 'MAGIC_LINK_USED', resource: 'Session' }, transaction);
      return updated;
    });
    return { user: this.publicUser(user), sessionToken: await this.createSession(user.id, fingerprint) };
  }

  async loginWithGoogle(idToken: string, fingerprint: RequestFingerprint) {
    if (!this.googleVerifier) throw new AppError('Google authentication is not configured', 503, 'GOOGLE_AUTH_NOT_CONFIGURED');
    const identity = await this.googleVerifier.verify(idToken);
    const user = await this.database.$transaction(async (transaction) => {
      const account = await transaction.authAccount.findUnique({
        where: { provider_providerAccountId: { provider: 'GOOGLE', providerAccountId: identity.subject } },
        include: { user: true },
      });
      if (account) return account.user;
      let existing = await transaction.user.findUnique({ where: { email: identity.email } });
      if (!existing) {
        const base = identity.email.split('@')[0]!.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'creator';
        const username = `${base}_${randomToken(5).toLowerCase()}`;
        existing = await transaction.user.create({
          data: {
            email: identity.email, name: identity.name, username, avatarUrl: identity.avatarUrl, emailVerifiedAt: new Date(),
            creatorProfile: { create: { displayName: identity.name } },
          },
        });
        const organization = await transaction.organization.create({
          data: { name: `${identity.name} workspace`, slug: `${username}-${randomToken(4).toLowerCase()}`, ownerId: existing.id, members: { create: { userId: existing.id, role: 'OWNER' } } },
        });
        await this.audit.append({ userId: existing.id, organizationId: organization.id, action: 'USER_SIGNED_UP_GOOGLE', resource: 'User', resourceId: existing.id }, transaction);
      } else if (!existing.emailVerifiedAt) {
        existing = await transaction.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date(), avatarUrl: existing.avatarUrl ?? identity.avatarUrl } });
      }
      await transaction.authAccount.create({ data: { userId: existing.id, provider: 'GOOGLE', providerAccountId: identity.subject } });
      return existing;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.audit.append({ userId: user.id, action: 'USER_LOGGED_IN_GOOGLE', resource: 'Session' });
    return { user: this.publicUser(user), sessionToken: await this.createSession(user.id, fingerprint) };
  }

  private async createSession(userId: string, fingerprint: RequestFingerprint): Promise<string> {
    const token = randomToken();
    await this.database.session.create({
      data: {
        userId,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + this.config.SESSION_TTL_HOURS * 60 * 60 * 1000),
        userAgent: fingerprint.userAgent?.slice(0, 512),
        ipHash: fingerprint.ip ? privacyHash(fingerprint.ip, this.config.PRIVACY_HASH_SECRET) : undefined,
      },
    });
    return token;
  }

  private publicUser(user: { id: string; email: string; name: string; username: string; emailVerifiedAt: Date | null; mfaEnabled: boolean }) {
    return { id: user.id, email: user.email, name: user.name, username: user.username, emailVerified: Boolean(user.emailVerifiedAt), mfaEnabled: user.mfaEnabled };
  }
}
