# Authivara — Verifiable Proof of Content Authorship on Stellar

[![CI](https://github.com/Tundeakinbami-dev/Authivara/actions/workflows/ci.yml/badge.svg)](https://github.com/Tundeakinbami-dev/Authivara/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stellar: Testnet](https://img.shields.io/badge/Stellar-Testnet%20Integrated-blueviolet.svg)](https://stellar.org)

Authivara provides cryptographic evidence and digital document verification anchored directly to the **Stellar Network**.

Creators, developers, and institutions can generate tamper-evident proof that the exact binary bytes of a work existed at a certified timestamp without uploading confidential content to any public blockchain.

---

## What Authivara Does

1. **Client-Side Document Fingerprinting**: Uses in-browser Web Workers to compute deterministic SHA-256 digests over multi-gigabyte files without transferring raw bytes to external networks.
2. **Private Off-Chain Storage**: Encrypts and stores original documents in private, access-controlled S3-compatible vaults.
3. **Decentralized Stellar Anchoring**: Records the 64-character SHA-256 fingerprint on the Stellar ledger using native `manageData` transactions or Soroban smart contracts.
4. **Verifiable Certificates**: Issues cryptographic PDF certificates with embedded QR verification codes and metadata hashes.
5. **Independent Public Verification**: Allows any verifier, counterparty, or court to check a file's integrity against the Stellar ledger using standard tools without depending on Authivara's backend.

---

## The Problem Authivara Solves

- **Pre-Publication Authorship Disputes**: Content creators, researchers, and software engineers frequently share unpublished manuscripts, drafts, source code, and design assets. Proving prior existence during copyright or trade-secret disputes is difficult without trusted third-party notarization.
- **Privacy Leakage on Blockchains**: Traditional blockchain notarization tools often upload unencrypted files or reveal sensitive metadata on public ledgers. Authivara maintains strict off-chain/on-chain separation—only the cryptographic digest is committed.
- **High Fees and Slow Finality on Other Chains**: Notarizing files on Ethereum or EVM L1s costs tens of dollars per transaction and requires waiting minutes for probabilistic finality. Stellar Consensus Protocol (SCP) settles in 3–5 seconds with transaction fees of approximately 0.00001 XLM (fraction of a cent).

---

## Who Benefits from Authivara

- **Digital Creators & Artists**: Establish proof of creation for visual designs, music compositions, and video masters before client delivery.
- **Software Engineers & Open Source Authors**: Create immutable timestamped releases and license provenance for proprietary algorithms.
- **Legal Professionals & Consultancies**: Document contract drafts, audit evidence, and disclosure chronologies.
- **Academic & Scientific Researchers**: Time-stamp research preprints and proprietary datasets prior to peer review.

---

## Why Stellar is Used

1. **Native Key/Value Storage (`manageData`)**: Stellar natively supports account-scoped key/value data entries up to 64 bytes. A SHA-256 digest is exactly 64 hexadecimal characters, fitting cleanly into the native ledger state without complex smart contract overhead.
2. **Deterministic Settlement Finality**: Stellar Consensus Protocol (SCP) achieves finality in 3–5 seconds without risk of reorganization.
3. **Economical Timestamping**: At 100 stroops (0.00001 XLM) per operation, document fingerprinting is economically sustainable at high volume.
4. **Independent Horizon Auditability**: Anyone with a transaction hash can query public Horizon instances (or block explorers like StellarExpert) to independently verify the anchored digest.
5. **Soroban Smart Contract Support**: Enables multi-party signing, on-chain revocation governance, and institutional registry contracts when programmatic access control is needed.

---

## System Architecture

```text
Browser (Web Worker) ──► SHA-256 Digest ──► Fastify API ──► Stellar Horizon ──► Stellar Testnet
      │                                         │
      └─ Presigned Encrypted PUT                ├─ PostgreSQL Proof + Tx Hash
            │                                   └─ Vector PDF Certificate + QR
            ▼
      Private S3 Vault
```

For complete technical specifications, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## What Functionality Works Today

- [x] Streaming SHA-256 hashing via browser Web Workers with fallback to Web Crypto API.
- [x] Presigned upload flow to private S3-compatible object storage with magic-byte validation and anti-malware adapter.
- [x] Canonical JSON metadata hashing binding title, category, tags, and visibility to proof records.
- [x] Proof registration generating unique `PCA-<12-hex-chars>` proof IDs.
- [x] Stellar Testnet native `manageData` transaction submission and fee estimation using `@stellar/stellar-sdk`.
- [x] Multi-method verification engine (token-scoped shared link, public proof lookup, direct local file verification).
- [x] Independent Horizon on-chain verification confirming transaction success, operation name prefix, and base64-decoded digest equality.
- [x] Tamper detection asserting altered file bytes fail integrity checks.
- [x] PDF Certificate generation with embedded QR codes linking to verifier URLs.
- [x] SHA-256 append-only chained audit logging.
- [x] Soroban Smart Contract reference implementation (`contracts/proof_anchor/`) with comprehensive unit tests.
- [x] Live Stellar Testnet verification CLI script with automatic Friendbot funding.

---

## What is Incomplete / On the Roadmap

- [ ] Merkle root batching to anchor hundreds of file proofs into a single Stellar transaction.
- [ ] SEP-0007 / Freighter wallet integration for creator-signed transactions directly from user wallets.
- [ ] Mainnet deployment and automated base reserve rebalancing.
- [ ] Enterprise decentralized multi-party revocation governance via Soroban contract deployment.

---

## Installation & Setup

### Prerequisites

- **Node.js**: `22.x` or `24.x` LTS
- **npm**: `10.x` or newer
- **PostgreSQL**: `14+` running locally or via Docker
- **Rust & Cargo** (optional, for Soroban contract compilation)

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Tundeakinbami-dev/Authivara.git
   cd Authivara
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   ```

4. **Initialize Prisma schema:**
   ```bash
   npm run prisma:generate
   ```

5. **Start development servers:**
   ```bash
   # Terminal 1: Next.js Frontend (http://localhost:4173)
   npm run dev

   # Terminal 2: Fastify API (http://localhost:4000)
   npm run dev:api
   ```

---

## Automated Testing

Authivara includes comprehensive unit, integration, cryptographic, and end-to-end tests:

```bash
# Run root test suite (Vitest)
npm test

# Run API workspace test suite
npm test --workspace @authivara/api

# Run full test suite across all packages
npm run test:all

# Typecheck and build all packages
npm run build:all
```

### Live Stellar Testnet Demonstration

To run an automated live demonstration that creates an account, funds it with Friendbot, submits an anchor transaction to Stellar Testnet, and verifies original vs. tampered file bytes:

```bash
npm run test:stellar:live
```

*Example Live Testnet Output:*
```text
======================================================================
  AUTHIVARA — LIVE STELLAR TESTNET ANCHORING & VERIFICATION
======================================================================

[1] Generated Testnet Keypair:
    Public Key: GDZVWY6PPBR2NMYU6TCKYS3UNZ5CO6TTQ43BIOYR45FCFRMR2TYPPBRA

[2] Requesting Friendbot funding from https://friendbot.stellar.org...
    ✓ Friendbot funding confirmed. Account activated on Stellar Testnet.

[3] Document Fingerprint Generated:
    Proof ID:    PCA-LIVE-002A56E0
    SHA-256:     72c2725e5d07a2f6830725564deb146c608bbd723f0765bdb703622f5c95e4fa
    Byte Count:  108 bytes (stored off-chain only)

[4] Submitting native manageData transaction to Stellar Testnet...
    ✓ Transaction Confirmed on Ledger!
    Status:           CONFIRMED
    Transaction Hash: 6db939d5484b3da94f25e72bd0cadcf728834c5ad8953e591c0497a41ced26eb
    Ledger Number:    5413708
    StellarExpert:    https://stellar.expert/explorer/testnet/tx/6db939d5484b3da94f25e72bd0cadcf728834c5ad8953e591c0497a41ced26eb

[5] Executing independent verification query against Horizon...
    Original Document Integrity: ✓ MATCH (VERIFIED)
    Altered Document Integrity:  ✓ TAMPER DETECTED (REJECTED)

======================================================================
  RESULT: ALL STELLAR TESTNET ANCHORING & VERIFICATION CHECKS PASSED
======================================================================
```

---

## Security and Privacy Assumptions

- **Integrity, Not Legal Copyright**: A matching cryptographic hash confirms that an identical sequence of bytes existed at a point in time. It does not certify that the submitter is the original author or that the document is authentic.
- **Zero On-Chain File Data**: Original documents never touch the public ledger.
- **Low-Entropy Document Considerations**: Highly predictable files (e.g. standard boilerplate NDAs) may be vulnerable to rainbow table guessing attacks against public hashes. Creators should incorporate unique salts or nonces into sensitive templates.
- For complete security review, threat matrix, and vulnerability reporting procedures, see [docs/SECURITY.md](docs/SECURITY.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

---

## Documentation Index

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): Architecture overview, design decisions, and Stellar vs. Soroban analysis.
- [docs/STELLAR.md](docs/STELLAR.md): Technical specification of Stellar operations, independent verification guide, and Horizon queries.
- [docs/SECURITY.md](docs/SECURITY.md): Threat mitigation matrix, access controls, and security policy.
- [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md): Detailed threat modeling across ledger, API, and storage boundaries.
- [docs/TESTING.md](docs/TESTING.md): Testing strategies, test suites, and reproduction commands.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): Local developer setup, workflows, and code organization.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Production deployment guide, safety gates, and cloud best practices.
- [docs/STELLAR_WAVE_GAP_ANALYSIS.md](docs/STELLAR_WAVE_GAP_ANALYSIS.md): Initial audit and gap analysis report.
- [docs/STELLAR_WAVE_EVIDENCE.md](docs/STELLAR_WAVE_EVIDENCE.md): Technical evidence and audit trails for the Stellar Wave Program.
- [CONTRIBUTING.md](CONTRIBUTING.md): Contribution guidelines and pull request standards.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
