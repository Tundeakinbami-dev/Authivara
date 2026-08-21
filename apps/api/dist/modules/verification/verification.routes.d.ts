import type { FastifyInstance } from 'fastify';
import type { VerificationService } from './verification.service.js';
export declare function registerVerificationRoutes(app: FastifyInstance, verification: VerificationService): Promise<void>;
