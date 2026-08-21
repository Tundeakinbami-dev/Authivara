import type { FastifyInstance } from 'fastify';
import { type PrismaClient } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
export declare function registerProfileRoutes(app: FastifyInstance, database: PrismaClient, audit: AuditService): Promise<void>;
