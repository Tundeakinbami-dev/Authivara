import { UnauthorizedError } from './errors.js';
export function requireUser(request, _reply) {
    if (!request.authUser)
        throw new UnauthorizedError();
}
