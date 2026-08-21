import { z } from 'zod';
const tokenParams = z.object({ shareToken: z.string().min(32).max(200) });
const verifySchema = z.object({
    contentHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
    requester: z.string().trim().max(200).optional(),
});
const publicProofParams = z.object({ proofId: z.string().regex(/^PCA-[A-Z0-9]{8,24}$/) });
const publicVerifySchema = z.object({
    contentHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
    proofId: z.string().regex(/^PCA-[A-Z0-9]{8,24}$/).optional(),
    requester: z.string().trim().max(200).optional(),
});
export async function registerVerificationRoutes(app, verification) {
    app.get('/v1/public/proofs/id/:proofId', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request) => {
        const { proofId } = publicProofParams.parse(request.params);
        return verification.inspectPublicProof(proofId);
    });
    app.post('/v1/public/verify', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
        const input = publicVerifySchema.parse(request.body);
        return verification.verifyPublic(input.contentHash, input.proofId, {
            requester: input.requester,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
        });
    });
    app.get('/v1/public/proofs/:shareToken', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request) => {
        const { shareToken } = tokenParams.parse(request.params);
        return verification.inspect(shareToken);
    });
    app.post('/v1/public/proofs/:shareToken/verify', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
        const { shareToken } = tokenParams.parse(request.params);
        const input = verifySchema.parse(request.body);
        return verification.verify(shareToken, input.contentHash, {
            requester: input.requester,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
        });
    });
}
