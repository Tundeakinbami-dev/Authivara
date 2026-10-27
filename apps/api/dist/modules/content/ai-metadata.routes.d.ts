import type { FastifyInstance } from 'fastify';
import type { AuditService } from '../audit/audit.service.js';
export declare function registerAiMetadataRoutes(app: FastifyInstance, database: any, audit: AuditService): Promise<void>;
