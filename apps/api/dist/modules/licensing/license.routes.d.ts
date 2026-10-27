import type { FastifyInstance } from 'fastify';
import type { AuditService } from '../audit/audit.service.js';
export declare function registerLicenseRoutes(app: FastifyInstance, database: any, audit: AuditService): Promise<void>;
