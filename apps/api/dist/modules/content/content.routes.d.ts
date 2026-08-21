import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AuditService } from '../audit/audit.service.js';
export declare function registerContentRoutes(app: FastifyInstance, database: PrismaClient, audit: AuditService): Promise<void>;
