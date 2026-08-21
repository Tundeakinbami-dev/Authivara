import { buildApp } from './app.js';
import { loadConfig } from './config.js';
const config = loadConfig();
const app = await buildApp(config);
async function shutdown(signal) {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    process.exit(0);
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
await app.listen({ host: config.HOST, port: config.PORT });
