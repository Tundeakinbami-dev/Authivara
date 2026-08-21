import { z } from 'zod';
import { requireUser } from '../../shared/request-context.js';
const registerSchema = z.object({
    uploadId: z.uuid(),
    organizationId: z.uuid().optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).optional(),
    category: z.string().trim().min(1).max(80),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']).default('PRIVATE'),
});
const proofParams = z.object({ proofId: z.string().regex(/^PCA-[A-Z0-9]{8,24}$/) });
const contentParams = z.object({ contentId: z.uuid() });
const versionSchema = z.object({
    uploadId: z.uuid(),
    label: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(5000).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});
export async function registerProvenanceRoutes(app, provenance) {
    app.post('/v1/content/register', { preHandler: requireUser }, async (request, reply) => {
        const result = await provenance.register(request.authUser.id, registerSchema.parse(request.body));
        reply.code(201);
        return result;
    });
    app.get('/v1/proofs/:proofId/status', { preHandler: requireUser }, async (request) => {
        const { proofId } = proofParams.parse(request.params);
        return { proof: await provenance.status(request.authUser.id, proofId) };
    });
    app.post('/v1/content/:contentId/versions', { preHandler: requireUser }, async (request, reply) => {
        const { contentId } = contentParams.parse(request.params);
        const result = await provenance.registerVersion(request.authUser.id, contentId, versionSchema.parse(request.body));
        reply.code(201);
        return result;
    });
    app.post('/v1/proofs/:proofId/refresh', { preHandler: requireUser }, async (request) => {
        const { proofId } = proofParams.parse(request.params);
        return { proof: await provenance.refreshStatus(request.authUser.id, proofId) };
    });
}
