# Production architecture decision

## Decision

Authivara uses a **modular monolith** for the first production deployment: Next.js/React in the web process and a separate Fastify/TypeScript API process backed by PostgreSQL/Prisma, private S3-compatible object storage, and a provider-neutral anchoring adapter.

Fastify was selected over a larger framework because the domain boundaries are explicit in the source tree, its request lifecycle and schema/error handling are small and observable, and the API can be split by module later without rewriting business rules. The web and API are independently deployable. PostgreSQL remains the system of record; public chains are timestamp anchors, not databases.

## Runtime flow

1. A user creates an account and creator profile by password, single-use magic link, or verified Google OIDC identity. A random session token is stored only in an HTTP-only, same-site cookie; only its SHA-256 digest is persisted.
2. The authenticated client requests a signed upload instruction after extension, declared MIME, and size policy checks.
3. The browser uploads directly to a private bucket with server-side encryption and visible progress/retry/cancellation support. No public proof is created yet.
4. Completion checks object size and magic bytes, streams the stored bytes through SHA-256, compares an optional client digest, and invokes the malware-scanner adapter. The API never trusts the extension alone.
5. Registration atomically creates `Content`, `ContentVersion`, and a pending `ProvenanceRecord`. Approved metadata is canonicalized and hashed.
6. `BlockchainProvider.registerProof()` receives only proof ID, content hash, optional metadata hash, version, and timestamp. It never receives the file, storage key, private note, user email, or IP data.
7. The receipt is reconciled into status, transaction, block, and finality fields. A certificate and unpredictable share token are created.
8. A verifier hashes the third-party file locally, then sends only the digest to the token-scoped public endpoint. The event retains a keyed IP digest rather than a raw IP.

## Module boundaries

The implemented API modules are `auth`, `users`, `content`, `uploads`, `audit`, `provenance`, `blockchain`, `verification`, and `certificates`. The normalized schema also establishes `organizations`, `licensing`, sessions, authentication accounts, and content versions. Billing, subscriptions, notifications, analytics, admin operations, webhooks, and full licensing workflows remain separate future modules; they must not be embedded in provenance controllers.

Controllers validate transport input and call services. Services own business rules. Prisma is the repository/data layer for this first deployment. External systems are behind `ObjectStorage`, `MalwareScanner`, and `BlockchainProvider` interfaces.

## Privacy and security invariants

- Original bytes and storage keys are never sent to an anchoring provider or returned by a public route.
- Buckets must block public access and enforce TLS, versioning, lifecycle rules, and KMS/SSE encryption.
- Production startup rejects the sandbox anchor and a missing malware scanner.
- Tenant/resource ownership is derived from the authenticated session, never accepted from request bodies.
- Mutations made with a cookie session require the configured `Origin`.
- Audit events form a SHA-256 chain. Production should additionally deny `UPDATE`/`DELETE` to the application database role, sign daily roots with KMS, and retain immutable backups.
- The browser hashes in a Web Worker using incremental chunks. The server independently streams and re-hashes any object placed in the vault.

## Deployment units

- `web`: Next.js standalone output behind a CDN/WAF.
- `api`: stateless Fastify containers, private database/storage connectivity.
- `anchor worker`: the HTTP provider may point to a separately scaled managed EVM/Merkle batcher. Hash batches are preferred to one transaction per work.
- `scanner`: isolated malware service with a short-lived signed read URL.
- `postgres`: encrypted PostgreSQL with point-in-time recovery.
- `object storage`: private S3/R2-compatible bucket; originals never go to a public chain.

Use separate KMS identities for storage, certificate signing, audit roots, and the anchoring wallet. Secrets belong in a secret manager, never environment files committed to source control.
