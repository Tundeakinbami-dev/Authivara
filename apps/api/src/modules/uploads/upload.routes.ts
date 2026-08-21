import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../../shared/request-context.js';
import type { UploadService } from './upload.service.js';

const initiateSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
  fileSize: z.number().int().positive(),
  checksumSha256Base64: z.string().regex(/^[A-Za-z0-9+/]{43}=$/).optional(),
});
const finalizeSchema = z.object({ clientHash: z.string().regex(/^[a-fA-F0-9]{64}$/).optional() });
const paramsSchema = z.object({ id: z.uuid() });

export async function registerUploadRoutes(app: FastifyInstance, uploads: UploadService) {
  app.post('/v1/uploads', { preHandler: requireUser, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const result = await uploads.initiate(request.authUser!.id, initiateSchema.parse(request.body));
    reply.code(201);
    return result;
  });

  app.post('/v1/uploads/:id/complete', { preHandler: requireUser }, async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const { clientHash } = finalizeSchema.parse(request.body ?? {});
    return uploads.finalize(request.authUser!.id, id, clientHash);
  });

  app.delete('/v1/uploads/:id', { preHandler: requireUser }, async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    await uploads.cancel(request.authUser!.id, id);
    reply.code(204).send();
  });
}
