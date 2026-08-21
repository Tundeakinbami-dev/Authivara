import type { FastifyInstance } from 'fastify';
import type { UploadService } from './upload.service.js';
export declare function registerUploadRoutes(app: FastifyInstance, uploads: UploadService): Promise<void>;
