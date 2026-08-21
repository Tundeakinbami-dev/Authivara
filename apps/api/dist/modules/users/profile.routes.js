import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireUser } from '../../shared/request-context.js';
const profileSchema = z.object({
    displayName: z.string().trim().min(2).max(100),
    bio: z.string().trim().max(1000).nullable().optional(),
    website: z.url().nullable().optional(),
    country: z.string().trim().length(2).nullable().optional(),
    socialLinks: z.record(z.string(), z.url()).nullable().optional(),
});
export async function registerProfileRoutes(app, database, audit) {
    app.get('/v1/creator-profile', { preHandler: requireUser }, async (request) => {
        const profile = await database.creatorProfile.findUniqueOrThrow({ where: { userId: request.authUser.id } });
        return { profile };
    });
    app.put('/v1/creator-profile', { preHandler: requireUser }, async (request) => {
        const input = profileSchema.parse(request.body);
        const userId = request.authUser.id;
        const profileData = {
            displayName: input.displayName,
            bio: input.bio,
            website: input.website,
            country: input.country,
            socialLinks: input.socialLinks === null ? Prisma.JsonNull : input.socialLinks,
        };
        const profile = await database.creatorProfile.upsert({
            where: { userId },
            create: { userId, ...profileData },
            update: profileData,
        });
        await audit.append({ userId, action: 'CREATOR_PROFILE_UPDATED', resource: 'CreatorProfile', resourceId: profile.id });
        return { profile };
    });
}
