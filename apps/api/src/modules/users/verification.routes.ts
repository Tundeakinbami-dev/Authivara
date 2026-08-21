import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../../shared/request-context.js';
import { NotFoundError } from '../../shared/errors.js';
import type { AuditService } from '../audit/audit.service.js';

const initiateVerificationSchema = z.object({
  level: z.number().int().min(1).max(3),
  provider: z.string().trim().max(100).optional(),
});

export async function registerVerificationIdentityRoutes(app: FastifyInstance, database: any, audit: AuditService) {
  app.get('/v1/profile/verification', { preHandler: requireUser }, async (request) => {
    const profile = await database.creatorProfile.findUnique({
      where: { userId: request.authUser!.id },
    });
    if (!profile) throw new NotFoundError('Creator profile');

    return {
      verificationLevel: profile.verificationLevel,
      verificationStatus: profile.verificationStatus,
      verificationProvider: profile.verificationProvider,
      verifiedAt: profile.verifiedAt,
      emailVerified: !!request.authUser!.emailVerifiedAt,
    };
  });

  app.post('/v1/profile/verification/initiate', { preHandler: requireUser }, async (request, reply) => {
    const input = initiateVerificationSchema.parse(request.body);
    const profile = await database.creatorProfile.findUnique({
      where: { userId: request.authUser!.id },
    });
    if (!profile) throw new NotFoundError('Creator profile');

    let newLevel = profile.verificationLevel;

    if (input.level === 1) {
      if (!request.authUser!.emailVerifiedAt) {
        return reply.code(400).send({ error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email must be verified first' } });
      }
      newLevel = Math.max(newLevel, 1);
    } else if (input.level === 2) {
      if (profile.verificationLevel < 1) {
        return reply.code(400).send({ error: { code: 'LEVEL_1_REQUIRED', message: 'Complete email verification first' } });
      }
      newLevel = Math.max(newLevel, 2);
    } else if (input.level === 3) {
      if (profile.verificationLevel < 2) {
        return reply.code(400).send({ error: { code: 'LEVEL_2_REQUIRED', message: 'Complete profile verification first' } });
      }
      newLevel = Math.max(newLevel, 3);
    }

    const updated = await database.creatorProfile.update({
      where: { userId: request.authUser!.id },
      data: {
        verificationLevel: newLevel,
        verificationProvider: input.provider ?? 'INTERNAL',
        verificationStatus: newLevel >= 3 ? 'VERIFIED' : newLevel >= 2 ? 'PROFILE_VERIFIED' : newLevel >= 1 ? 'EMAIL_VERIFIED' : 'UNVERIFIED',
        verifiedAt: newLevel > profile.verificationLevel ? new Date() : profile.verifiedAt,
      },
    });

    await audit.append({
      userId: request.authUser!.id,
      action: 'VERIFICATION_LEVEL_CHANGED',
      resource: 'CreatorProfile',
      resourceId: profile.id,
      metadata: { previousLevel: profile.verificationLevel, newLevel },
    });

    return {
      verificationLevel: updated.verificationLevel,
      verificationStatus: updated.verificationStatus,
      verifiedAt: updated.verifiedAt,
    };
  });

  app.post('/v1/profile/verification/kyc', { preHandler: requireUser }, async (request, reply) => {
    const profile = await database.creatorProfile.findUnique({
      where: { userId: request.authUser!.id },
    });
    if (!profile) throw new NotFoundError('Creator profile');
    if (profile.verificationLevel < 2) {
      return reply.code(400).send({ error: { code: 'LEVEL_2_REQUIRED', message: 'Complete profile verification first' } });
    }

    const updated = await database.creatorProfile.update({
      where: { userId: request.authUser!.id },
      data: {
        verificationLevel: 3,
        verificationProvider: 'KYC_PROVIDER',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    await audit.append({
      userId: request.authUser!.id,
      action: 'KYC_VERIFICATION_COMPLETED',
      resource: 'CreatorProfile',
      resourceId: profile.id,
    });

    return {
      verificationLevel: updated.verificationLevel,
      verificationStatus: updated.verificationStatus,
      verifiedAt: updated.verifiedAt,
    };
  });

  app.get('/v1/users/:userId/verification-badge', { preHandler: requireUser }, async (request) => {
    const { userId } = z.object({ userId: z.uuid() }).parse(request.params);
    const profile = await database.creatorProfile.findUnique({ where: { userId } });
    return {
      verificationLevel: profile?.verificationLevel ?? 0,
      verificationStatus: profile?.verificationStatus ?? 'UNVERIFIED',
      badge: profile && profile.verificationLevel >= 3 ? 'Verified Creator' : profile && profile.verificationLevel >= 2 ? 'Profile Verified' : profile && profile.verificationLevel >= 1 ? 'Email Verified' : 'Unverified',
    };
  });
}
