import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import type { AppConfig } from './config.js';
import { createDatabase } from './database.js';
import { AppError } from './shared/errors.js';
import { AuditService } from './modules/audit/audit.service.js';
import { AuthService } from './modules/auth/auth.service.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { registerProfileRoutes } from './modules/users/profile.routes.js';
import type { BlockchainProvider } from './modules/blockchain/blockchain-provider.js';
import { SandboxBlockchainProvider } from './modules/blockchain/sandbox.provider.js';
import { HttpAnchorProvider } from './modules/blockchain/http-anchor.provider.js';
import { StellarAnchorProvider } from './modules/blockchain/stellar.provider.js';
import type { ObjectStorage } from './modules/uploads/object-storage.js';
import { S3ObjectStorage } from './modules/uploads/s3-object-storage.js';
import type { MalwareScanner } from './modules/uploads/malware-scanner.js';
import { NoopMalwareScanner, RemoteMalwareScanner } from './modules/uploads/malware-scanner.js';
import { UploadService } from './modules/uploads/upload.service.js';
import { registerUploadRoutes } from './modules/uploads/upload.routes.js';
import { ProvenanceService } from './modules/provenance/provenance.service.js';
import { registerProvenanceRoutes } from './modules/provenance/provenance.routes.js';
import { VerificationService } from './modules/verification/verification.service.js';
import { registerVerificationRoutes } from './modules/verification/verification.routes.js';
import { registerCertificateRoutes } from './modules/certificates/certificate.routes.js';
import { registerContentRoutes } from './modules/content/content.routes.js';
import { registerAiMetadataRoutes } from './modules/content/ai-metadata.routes.js';
import { registerLicenseRoutes } from './modules/licensing/license.routes.js';
import { registerVerificationIdentityRoutes } from './modules/users/verification.routes.js';
import { DevelopmentEmailSender, RemoteEmailSender } from './modules/auth/email-sender.js';
import { GoogleOidcVerifier } from './modules/auth/google-identity.js';

export interface AppDependencies {
  database?: ReturnType<typeof createDatabase>;
  storage?: ObjectStorage;
  scanner?: MalwareScanner;
  blockchain?: BlockchainProvider;
}

export async function buildApp(config: AppConfig, dependencies: AppDependencies = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.NODE_ENV !== 'test', trustProxy: true, bodyLimit: 1_048_576 });
  const database = dependencies.database ?? createDatabase();
  const storage = dependencies.storage ?? new S3ObjectStorage(config);
  const scanner = dependencies.scanner ?? (config.MALWARE_SCANNER_URL
    ? new RemoteMalwareScanner(config.MALWARE_SCANNER_URL, config.MALWARE_SCANNER_TOKEN)
    : new NoopMalwareScanner());
  const blockchain = dependencies.blockchain ?? (config.ANCHOR_PROVIDER === 'http'
    ? new HttpAnchorProvider(config.ANCHOR_NETWORK, config.ANCHOR_API_URL!, config.ANCHOR_API_KEY!)
    : config.ANCHOR_PROVIDER === 'stellar'
      ? new StellarAnchorProvider({
        horizonUrl: config.STELLAR_HORIZON_URL,
        networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
        anchorAccount: config.STELLAR_ANCHOR_ACCOUNT!,
        anchorSecret: config.STELLAR_ANCHOR_SECRET!,
      })
      : new SandboxBlockchainProvider());
  const audit = new AuditService(database);
  const emailSender = config.EMAIL_DELIVERY_URL
    ? new RemoteEmailSender(config.EMAIL_DELIVERY_URL, config.EMAIL_DELIVERY_TOKEN)
    : new DevelopmentEmailSender();
  const googleVerifier = config.GOOGLE_CLIENT_ID ? new GoogleOidcVerifier(config.GOOGLE_CLIENT_ID) : undefined;
  const auth = new AuthService(database, audit, config, emailSender, googleVerifier);

  await app.register(cookie);
  await app.register(cors, { origin: config.APP_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    strictTransportSecurity: config.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.decorateRequest('authUser', null);
  app.addHook('onRequest', async (request) => {
    request.authUser = await auth.authenticate(request.cookies[config.SESSION_COOKIE_NAME]);
  });
  app.addHook('preValidation', async (request) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
    const origin = request.headers.origin;
    if ((origin && origin !== config.APP_ORIGIN) || (request.authUser && !origin)) {
      throw new AppError('Request origin is not allowed', 403, 'INVALID_ORIGIN');
    }
  });

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async () => {
    await database.$queryRaw`SELECT 1`;
    return { status: 'ready', anchoringNetwork: blockchain.network };
  });

  await registerAuthRoutes(app, auth, config);
  await registerProfileRoutes(app, database, audit);
  await registerUploadRoutes(app, new UploadService(database, storage, scanner, audit, config));
  await registerProvenanceRoutes(app, new ProvenanceService(database, blockchain, audit, config));
  await registerVerificationRoutes(app, new VerificationService(database, config, blockchain));
  await registerCertificateRoutes(app, database, config, audit);
  await registerContentRoutes(app, database, audit);
  await registerAiMetadataRoutes(app, database, audit);
  await registerLicenseRoutes(app, database, audit);
  await registerVerificationIdentityRoutes(app, database, audit);

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: error.issues } });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message, details: error.details } });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    }
    request.log.error({ err: error }, 'Unhandled request error');
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  });

  app.addHook('onClose', async () => database.$disconnect());
  return app;
}
