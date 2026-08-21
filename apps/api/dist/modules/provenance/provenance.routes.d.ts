import type { FastifyInstance } from 'fastify';
import type { ProvenanceService } from './provenance.service.js';
export declare function registerProvenanceRoutes(app: FastifyInstance, provenance: ProvenanceService): Promise<void>;
