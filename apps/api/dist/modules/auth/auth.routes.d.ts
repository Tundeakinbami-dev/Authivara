import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../config.js';
import type { AuthService } from './auth.service.js';
export declare function registerAuthRoutes(app: FastifyInstance, auth: AuthService, config: AppConfig): Promise<void>;
