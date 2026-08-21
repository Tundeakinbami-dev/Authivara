import { canonicalJson, sha256 } from '../../shared/crypto.js';
export class AuditService {
    database;
    constructor(database) {
        this.database = database;
    }
    async append(input, client = this.database) {
        const previous = await client.auditLog.findFirst({
            where: { organizationId: input.organizationId ?? null },
            orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
            select: { eventHash: true },
        });
        const timestamp = new Date();
        const eventHash = sha256(canonicalJson({ ...input, previousHash: previous?.eventHash ?? null, timestamp: timestamp.toISOString() }));
        return client.auditLog.create({
            data: { ...input, timestamp, previousHash: previous?.eventHash, eventHash },
        });
    }
}
