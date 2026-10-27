import type { FastifyReply, FastifyRequest } from 'fastify';
export interface AuthenticatedUser {
    id: string;
    email: string;
    emailVerifiedAt: Date | null;
}
declare module 'fastify' {
    interface FastifyRequest {
        authUser: AuthenticatedUser | null;
    }
}
export declare function requireUser(request: FastifyRequest, _reply: FastifyReply): asserts request is FastifyRequest & {
    authUser: AuthenticatedUser;
};
