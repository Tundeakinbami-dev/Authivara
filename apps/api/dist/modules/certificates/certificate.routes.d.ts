import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from '../../config.js';
import type { AuditService } from '../audit/audit.service.js';
export declare function registerCertificateRoutes(app: FastifyInstance, database: PrismaClient, config: AppConfig, audit: AuditService): Promise<void>;
