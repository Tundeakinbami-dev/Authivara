import { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config.js';
import { createDatabase } from './database.js';
import type { BlockchainProvider } from './modules/blockchain/blockchain-provider.js';
import type { ObjectStorage } from './modules/uploads/object-storage.js';
import type { MalwareScanner } from './modules/uploads/malware-scanner.js';
export interface AppDependencies {
    database?: ReturnType<typeof createDatabase>;
    storage?: ObjectStorage;
    scanner?: MalwareScanner;
    blockchain?: BlockchainProvider;
}
export declare function buildApp(config: AppConfig, dependencies?: AppDependencies): Promise<FastifyInstance>;
