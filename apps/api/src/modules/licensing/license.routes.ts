import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../../shared/request-context.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors.js';
import type { AuditService } from '../audit/audit.service.js';

const paramsSchema = z.object({ licenseId: z.uuid() });
const contentParams = z.object({ contentId: z.uuid() });

const createLicenseSchema = z.object({
  contentId: z.uuid(),
  licensor: z.string().trim().min(1).max(200),
  licensee: z.string().trim().min(1).max(200),
  licenseType: z.enum(['PERSONAL', 'COMMERCIAL']),
  exclusive: z.boolean().default(false),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  geographicScope: z.string().trim().max(200).optional(),
  usageScope: z.string().trim().max(500),
  impressions: z.number().int().positive().optional(),
  modificationPermission: z.boolean().default(false),
  resalePermission: z.boolean().default(false),
  aiTrainingPermission: z.boolean().default(false),
  price: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
});

const transferLicenseSchema = z.object({
  toLicensee: z.string().trim().min(1).max(200),
  effectiveDate: z.coerce.date(),
  agreementReference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const updateLicenseStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'TERMINATED']),
});

export async function registerLicenseRoutes(app: FastifyInstance, database: any, audit: AuditService) {
  app.post('/v1/licenses', { preHandler: requireUser }, async (request, reply) => {
    const input = createLicenseSchema.parse(request.body);
    const content = await database.content.findUnique({ where: { id: input.contentId } });
    if (!content) throw new NotFoundError('Content');
    if (content.ownerId !== request.authUser!.id) throw new ForbiddenError();

    const license = await database.license.create({
      data: {
        contentId: input.contentId,
        createdBy: request.authUser!.id,
        licensor: input.licensor,
        licensee: input.licensee,
        licenseType: input.licenseType,
        exclusive: input.exclusive,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        geographicScope: input.geographicScope ?? null,
        usageScope: input.usageScope,
        impressions: input.impressions ?? null,
        modificationPermission: input.modificationPermission,
        resalePermission: input.resalePermission,
        aiTrainingPermission: input.aiTrainingPermission,
        price: input.price ?? null,
        currency: input.currency ?? null,
        status: 'DRAFT',
      },
    });

    await audit.append({
      userId: request.authUser!.id,
      organizationId: content.organizationId ?? undefined,
      action: 'LICENSE_CREATED',
      resource: 'License',
      resourceId: license.id,
    });

    reply.code(201);
    return { license };
  });

  app.get('/v1/licenses', { preHandler: requireUser }, async (request) => {
    const licenses = await database.license.findMany({
      where: { createdBy: request.authUser!.id },
      include: { content: { select: { id: true, title: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { licenses };
  });

  app.get('/v1/licenses/:licenseId', { preHandler: requireUser }, async (request) => {
    const { licenseId } = paramsSchema.parse(request.params);
    const license = await database.license.findUnique({
      where: { id: licenseId },
      include: { content: { select: { id: true, title: true, category: true, contentHash: true } }, transferRecords: true },
    });
    if (!license) throw new NotFoundError('License');
    if (license.createdBy !== request.authUser!.id) throw new ForbiddenError();
    return { license };
  });

  app.get('/v1/content/:contentId/licenses', { preHandler: requireUser }, async (request) => {
    const { contentId } = contentParams.parse(request.params);
    const content = await database.content.findUnique({ where: { id: contentId } });
    if (!content) throw new NotFoundError('Content');
    if (content.ownerId !== request.authUser!.id) throw new ForbiddenError();

    const licenses = await database.license.findMany({
      where: { contentId },
      include: { transferRecords: true },
      orderBy: { createdAt: 'desc' },
    });
    return { licenses };
  });

  app.patch('/v1/licenses/:licenseId/status', { preHandler: requireUser }, async (request) => {
    const { licenseId } = paramsSchema.parse(request.params);
    const input = updateLicenseStatusSchema.parse(request.body);
    const license = await database.license.findUnique({ where: { id: licenseId } });
    if (!license) throw new NotFoundError('License');
    if (license.createdBy !== request.authUser!.id) throw new ForbiddenError();

    const updated = await database.license.update({
      where: { id: licenseId },
      data: { status: input.status },
    });

    await audit.append({
      userId: request.authUser!.id,
      action: 'LICENSE_STATUS_CHANGED',
      resource: 'License',
      resourceId: licenseId,
      metadata: { previousStatus: license.status, newStatus: input.status },
    });

    return { license: updated };
  });

  app.post('/v1/licenses/:licenseId/transfer', { preHandler: requireUser }, async (request, reply) => {
    const { licenseId } = paramsSchema.parse(request.params);
    const input = transferLicenseSchema.parse(request.body);
    const license = await database.license.findUnique({ where: { id: licenseId } });
    if (!license) throw new NotFoundError('License');
    if (license.createdBy !== request.authUser!.id) throw new ForbiddenError();
    if (license.status !== 'ACTIVE') throw new ForbiddenError();

    const transfer = await database.licenseTransfer.create({
      data: {
        licenseId,
        fromLicensee: license.licensee,
        toLicensee: input.toLicensee,
        effectiveDate: input.effectiveDate,
        agreementReference: input.agreementReference ?? null,
        notes: input.notes ?? null,
        createdBy: request.authUser!.id,
      },
    });

    await database.license.update({
      where: { id: licenseId },
      data: { licensee: input.toLicensee },
    });

    await audit.append({
      userId: request.authUser!.id,
      action: 'LICENSE_TRANSFERRED',
      resource: 'License',
      resourceId: licenseId,
      metadata: { fromLicensee: license.licensee, toLicensee: input.toLicensee },
    });

    reply.code(201);
    return { transfer };
  });

  app.get('/v1/licenses/:licenseId/transfers', { preHandler: requireUser }, async (request) => {
    const { licenseId } = paramsSchema.parse(request.params);
    const license = await database.license.findUnique({ where: { id: licenseId } });
    if (!license) throw new NotFoundError('License');
    if (license.createdBy !== request.authUser!.id) throw new ForbiddenError();

    const transfers = await database.licenseTransfer.findMany({
      where: { licenseId },
      orderBy: { effectiveDate: 'desc' },
    });
    return { transfers };
  });
}
