import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../../config.js';
import type { AuthService } from './auth.service.js';
import { requireUser } from '../../shared/request-context.js';

const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(2).max(100),
  username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,30}$/),
  displayName: z.string().trim().min(2).max(100),
  country: z.string().trim().length(2).optional(),
});
const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(128) });
const magicRequestSchema = z.object({ email: z.email() });
const magicVerifySchema = z.object({ token: z.string().min(32).max(200) });
const googleSchema = z.object({ idToken: z.string().min(100).max(10_000) });

export async function registerAuthRoutes(app: FastifyInstance, auth: AuthService, config: AppConfig) {
  const cookieOptions = {
    path: '/', httpOnly: true, sameSite: 'strict' as const,
    secure: config.NODE_ENV === 'production', maxAge: config.SESSION_TTL_HOURS * 60 * 60,
  };

  app.post('/v1/auth/signup', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = signUpSchema.parse(request.body);
    const result = await auth.signUp(body, { ip: request.ip, userAgent: request.headers['user-agent'] });
    reply.setCookie(config.SESSION_COOKIE_NAME, result.sessionToken, cookieOptions).code(201);
    return { user: result.user };
  });

  app.post('/v1/auth/login', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await auth.login(body.email, body.password, { ip: request.ip, userAgent: request.headers['user-agent'] });
    reply.setCookie(config.SESSION_COOKIE_NAME, result.sessionToken, cookieOptions);
    return { user: result.user };
  });

  app.post('/v1/auth/magic-link', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const { email } = magicRequestSchema.parse(request.body);
    const result = await auth.requestMagicLink(email);
    reply.code(202);
    return { message: 'If the account exists, a sign-in link has been sent.', ...result };
  });

  app.post('/v1/auth/magic-link/verify', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { token } = magicVerifySchema.parse(request.body);
    const result = await auth.loginWithMagicLink(token, { ip: request.ip, userAgent: request.headers['user-agent'] });
    reply.setCookie(config.SESSION_COOKIE_NAME, result.sessionToken, cookieOptions);
    return { user: result.user };
  });

  app.post('/v1/auth/google', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { idToken } = googleSchema.parse(request.body);
    const result = await auth.loginWithGoogle(idToken, { ip: request.ip, userAgent: request.headers['user-agent'] });
    reply.setCookie(config.SESSION_COOKIE_NAME, result.sessionToken, cookieOptions);
    return { user: result.user };
  });

  app.post('/v1/auth/logout', async (request, reply) => {
    await auth.logout(request.cookies[config.SESSION_COOKIE_NAME]);
    reply.clearCookie(config.SESSION_COOKIE_NAME, { path: '/' }).code(204).send();
  });

  app.get('/v1/auth/me', { preHandler: requireUser }, async (request) => ({ user: request.authUser }));
}
