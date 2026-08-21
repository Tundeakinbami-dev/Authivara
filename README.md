# Authivara — Proof of Content Authorship

Authivara is a privacy-first digital provenance SaaS product for creators and organisations. It creates verifiable evidence that an exact file fingerprint existed at a specific time, while keeping the original content on the user's device.

This repository contains a high-fidelity browser demo plus a production-oriented API foundation. The demo provides a six-stage registration flow, streaming SHA-256 hashing, local verification, portfolio management, proof inspection, provenance history, and persisted browser state. The API adds PostgreSQL/Prisma records, encrypted signed uploads, independent server hashing, file-signature checks, malware-scanner integration, provider-based anchoring, status reconciliation, professional QR-enabled PDF certificates, metadata-comparable version history, dashboard analytics, and token-scoped public verification.

Blockchain anchoring defaults to an explicitly labelled development sandbox and is never represented as a live transaction. Production startup rejects that adapter and requires a configured anchoring gateway and malware scanner.

## Run locally

Use Node.js 22 LTS or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:4173`. A production bundle can be created with `npm run build`; unit tests run with `npm test`.

## Run the API foundation

Copy `.env.example` to `.env`, supply PostgreSQL and private S3-compatible storage settings, then run:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run dev:api
```

The API listens on `http://localhost:4000` by default. `prisma:deploy` applies the checked-in PostgreSQL migrations, including digest constraints and append-only audit guards. See [the architecture decision](docs/ARCHITECTURE.md), [API workflows](docs/api/WORKFLOWS.md), and [requirements audit](docs/REQUIREMENTS_AUDIT.md).

The exact-byte hashing contract, secondary-hash distinctions, privacy-safe duplicate behavior, and verification result semantics are documented in [Hashing and verification](docs/HASHING_AND_VERIFICATION.md).

Set `NEXT_PUBLIC_API_ENABLED=true` before building the web app to enable account onboarding, authenticated content loading, encrypted signed uploads, durable proof creation, share-link rotation, and public token verification. Leave it `false` for the self-contained browser sandbox.

## What the proof means

An Authivara proof supports the statement:

> This exact cryptographic fingerprint was submitted by this account and recorded at this time.

It does not, on its own:

- award or register copyright;
- determine authorship or ownership when claims conflict;
- verify the real-world identity of an unverified account;
- grant a licence or prove payment;
- guarantee admissibility, enforcement, or an outcome in court.

These concepts remain separate throughout the product:

| Concept | Authivara record | Required external authority or action |
| --- | --- | --- |
| File existence | SHA-256 fingerprint + timestamp anchor | None for technical verification |
| Account identity | Attestation / KYC state, stored separately | Identity provider and workspace policy |
| Ownership claim | Claim event with claimant and supporting evidence | Counterparty agreement or legal adjudication |
| Licence | Versioned contractual record linked to work/version | Valid agreement, signatures, and local law |
| Copyright registration | External registry reference only | Relevant national or regional copyright office |
| Enforcement | Evidence export and case workflow | Counsel, platform, mediator, regulator, or court |

## Production architecture

The browser should remain the trust boundary for original private files. A production implementation is designed as four independently deployable layers:

1. **Web client** — performs streaming SHA-256 hashing in a Web Worker and never transmits original files except to the explicitly selected encrypted private vault. Preview derivative/EXIF handling and client envelope signing remain release work.
2. **Proof API** — authenticates users, validates canonical metadata, assigns monotonic record IDs, stores an append-only event log, and places hashes into an anchoring queue. Idempotency keys prevent duplicate registrations.
3. **Anchor worker** — batches evidence envelopes into a Merkle tree, submits only the root to the configured chain, records transaction/finality state, and retains inclusion paths for independent verification. A second RFC 3161 timestamp provider can provide chain-independent redundancy.
4. **Verification service** — publishes certificates, inclusion proofs, chain receipts, revocation/supersession events, and a versioned verification library. It never needs the original content.

Recommended production components are PostgreSQL with row-level workspace isolation, an append-only evidence event table, object storage for user-authorised encrypted files only, Redis or a managed queue for anchoring jobs, KMS-backed signing keys, OpenTelemetry, and a regional edge/CDN layer. The chain provider must be selected after cost, finality, validator diversity, longevity, and data-residency review—not for marketing value.

### Core record envelope

```json
{
  "schema": "authivara-proof/v1",
  "digest": { "algorithm": "sha-256", "value": "hex…" },
  "work": { "id": "uuid", "version": 1, "media_type": "image/tiff" },
  "subject": { "account_id": "uuid", "identity_assurance": "verified" },
  "assertion": "account-submitted-existence",
  "submitted_at": "server-issued-rfc3339",
  "anchor": { "batch_id": "uuid", "merkle_path": [], "network": "…", "transaction": "…" }
}
```

Canonical JSON (RFC 8785) should be used before signing. The client file digest, canonical envelope digest, server signature, Merkle inclusion path, transaction receipt, and finality block must all be independently verifiable.

## Security and privacy baseline

- Passwordless WebAuthn/passkeys and MFA recovery; SSO/SAML for enterprise workspaces.
- Short-lived sessions in secure, HTTP-only, same-site cookies; CSRF and origin validation on mutations.
- Tenant IDs derived from the authenticated session, never trusted from request bodies.
- Strict content security policy, HSTS, `frame-ancestors 'none'`, referrer restrictions, and permissions policy.
- Envelope signing keys in KMS/HSM with rotation and public key history; anchoring wallets separated from application credentials.
- Append-only audit events, signed daily audit roots, immutable backups, and tested point-in-time recovery.
- Per-user and per-workspace rate limits, malware scanning only for explicitly uploaded vault objects, and abuse controls on public pages.
- Data minimisation, consented public metadata, configurable retention, export, deletion of off-chain personal data, and documented limits where immutable public anchors cannot be erased.
- Secret scanning, dependency review, SAST, build provenance, signed containers, IaC scanning, and protected production promotion.

See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) and [docs/ROADMAP.md](docs/ROADMAP.md) for the operational plan.

## Demo and release limitations

When `NEXT_PUBLIC_API_ENABLED=false`, the visible demo stores example proofs in browser `localStorage`. Production API mode is wired to signup, creator-profile creation, signed uploads, proof registration, content loading, share links, and public verification. Deployments must still configure email/Google providers, MFA, payment, KYC, legal registry, the reconciliation worker, storage/scanner infrastructure, and live anchoring credentials. Generated demo anchors are visibly labelled **Authivara Sandbox Anchor**.
