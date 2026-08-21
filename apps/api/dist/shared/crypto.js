import { createHash, createHmac, randomBytes } from 'node:crypto';
export function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}
export function randomToken(bytes = 32) {
    return randomBytes(bytes).toString('base64url');
}
export function randomProofId() {
    return `PCA-${randomBytes(6).toString('hex').toUpperCase()}`;
}
export function privacyHash(value, secret) {
    return createHmac('sha256', secret).update(value).digest('hex');
}
export function canonicalJson(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(',')}]`;
    const record = value;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}
