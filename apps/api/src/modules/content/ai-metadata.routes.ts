import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../../shared/request-context.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors.js';
import type { AuditService } from '../audit/audit.service.js';

const paramsSchema = z.object({ contentId: z.uuid() });

const aiMetadataSchema = z.object({
  origin: z.enum(['HUMAN_CREATED', 'AI_ASSISTED', 'AI_GENERATED', 'AI_EDITED', 'UNKNOWN']),
  toolName: z.string().trim().max(100).optional(),
  modelName: z.string().trim().max(100).optional(),
  creationNotes: z.string().trim().max(2000).optional(),
  editingNotes: z.string().trim().max(2000).optional(),
  humanContributionNotes: z.string().trim().max(2000).optional(),
});

export async function registerAiMetadataRoutes(app: FastifyInstance, database: any, audit: AuditService) {
  app.get('/v1/content/:contentId/ai-metadata', { preHandler: requireUser }, async (request) => {
    const { contentId } = paramsSchema.parse(request.params);
    const content = await database.content.findUnique({ where: { id: contentId }, include: { aiMetadata: true } });
    if (!content) throw new NotFoundError('Content');
    if (content.ownerId !== request.authUser!.id) throw new ForbiddenError();
    return { aiMetadata: content.aiMetadata ?? null };
  });

  app.put('/v1/content/:contentId/ai-metadata', { preHandler: requireUser }, async (request) => {
    const { contentId } = paramsSchema.parse(request.params);
    const content = await database.content.findUnique({ where: { id: contentId } });
    if (!content) throw new NotFoundError('Content');
    if (content.ownerId !== request.authUser!.id) throw new ForbiddenError();

    const input = aiMetadataSchema.parse(request.body);
    const aiMetadata = await database.contentAiMetadata.upsert({
      where: { contentId },
      create: {
        contentId,
        origin: input.origin,
        toolName: input.toolName ?? null,
        modelName: input.modelName ?? null,
        creationNotes: input.creationNotes ?? null,
        editingNotes: input.editingNotes ?? null,
        humanContributionNotes: input.humanContributionNotes ?? null,
        disclosureSource: 'CREATOR_PROVIDED',
      },
      update: {
        origin: input.origin,
        toolName: input.toolName ?? null,
        modelName: input.modelName ?? null,
        creationNotes: input.creationNotes ?? null,
        editingNotes: input.editingNotes ?? null,
        humanContributionNotes: input.humanContributionNotes ?? null,
      },
    });

    await audit.append({
      userId: request.authUser!.id,
      organizationId: content.organizationId ?? undefined,
      action: 'AI_METADATA_UPDATED',
      resource: 'Content',
      resourceId: contentId,
    });

    return { aiMetadata };
  });

  app.delete('/v1/content/:contentId/ai-metadata', { preHandler: requireUser }, async (request) => {
    const { contentId } = paramsSchema.parse(request.params);
    const content = await database.content.findUnique({ where: { id: contentId } });
    if (!content) throw new NotFoundError('Content');
    if (content.ownerId !== request.authUser!.id) throw new ForbiddenError();

    await database.contentAiMetadata.delete({ where: { contentId } }).catch(() => {});

    await audit.append({
      userId: request.authUser!.id,
      organizationId: content.organizationId ?? undefined,
      action: 'AI_METADATA_DELETED',
      resource: 'Content',
      resourceId: contentId,
    });

    return { deleted: true };
  });
}
