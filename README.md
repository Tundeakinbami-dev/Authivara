# Authivara — verifiable proof of content registration

Authivara helps creators record evidence that the exact bytes of a work were submitted at a particular time. The browser derives a SHA-256 fingerprint; the API stores a proof record, produces a certificate, and can anchor that fingerprint on Stellar Testnet. It does not upload original files to Stellar and it does not determine copyright ownership.

## Why Stellar

Stellar provides inexpensive, public ledger transactions and a native `manageData` operation. Authivara uses that operation to record only a 64-character SHA-256 digest. Anyone with the transaction hash can retrieve the transaction from Horizon and compare the decoded data entry with a locally computed digest. This makes the timestamped evidence independently checkable without disclosing the work itself.

## Architecture

```text
Browser → SHA-256 digest → Fastify/Prisma API → Stellar Horizon → Stellar Testnet
                              │                         │
                              └─ PostgreSQL proof + tx hash ── public verification
```

The API selects an anchoring provider through `ANCHOR_PROVIDER`:

- `sandbox` is deterministic and development-only; production startup rejects it.
- `http` delegates hashes to a compatible external anchor service.
- `stellar` signs and submits a native Testnet `manageData` transaction. Its key is `authivara-proof:<proof-id>` and its value is the SHA-256 hex digest.

See [the Stellar integration guide](docs/STELLAR.md) for the exact on-chain footprint, configuration, independent verification procedure, and limits. [Architecture notes](docs/ARCHITECTURE.md) and [API workflows](docs/api/WORKFLOWS.md) describe the rest of the service.

## Setup

Use Node.js 22 or newer.

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:4173`. To run the API, configure PostgreSQL and S3-compatible storage variables, then:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run dev:api
```

To enable Stellar Testnet anchoring, set the environment variables in [`docs/STELLAR.md`](docs/STELLAR.md). Use a dedicated funded Testnet account. Never commit or expose `STELLAR_ANCHOR_SECRET`.

## Implemented features

- Browser-side streaming SHA-256 hashing and local demo verification.
- Authenticated uploads with server-side hashing, signature checks, duplicate handling, and malware-scanner adapter.
- Proof records, share links, public proof inspection, QR PDF certificates, version history, and audit events.
- Native Stellar Testnet proof anchors with Horizon transaction status, digest-only operation verification, account/secret consistency checks, and XLM fee estimates.
- Provider configuration safety gates and GitHub Actions CI.

## Test and build

```bash
npm test
npm test --workspace @authivara/api
npm run build
npm run build:api
```

The Stellar provider tests use a mocked Horizon client. They demonstrate that a signed transaction is built for a digest, successful `manage_data` operations verify the digest, and mismatched Stellar credentials are rejected. No live Testnet transaction is submitted in CI.

## Contributing

Create a focused branch, make the smallest complete change, add or update tests for behavior changes, and run the commands above before opening a pull request. Do not commit `.env` files, anchor seeds, or production credentials. Keep documentation claims tied to executable behavior; record changes to the on-chain format in `docs/STELLAR.md`.

## Limitations

The Stellar path currently makes one Testnet transaction per proof; it does not batch roots, provide configurable finality depth, rotate keys, or target Mainnet. A matching digest confirms byte-for-byte correspondence with a recorded proof; it is not a copyright registration, identity check, licence, payment, or legal decision. The full security and operational backlog remains in [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) and [docs/ROADMAP.md](docs/ROADMAP.md).
