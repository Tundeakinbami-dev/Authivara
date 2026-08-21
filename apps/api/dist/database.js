import { PrismaClient } from '@prisma/client';
export function createDatabase() {
    return new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
}
