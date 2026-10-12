import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from './errors.js';

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

export function requireUser(request: FastifyRequest, _reply: FastifyReply): asserts request is FastifyRequest & { authUser: AuthenticatedUser } {
  if (!request.authUser) throw new UnauthorizedError();
}
