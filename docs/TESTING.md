# Automated Testing Guide: Authivara

**Document Version:** 1.0.0  
**Testing Framework:** Vitest 4.x + Official Stellar SDK  

---

## 1. Test Architecture Overview

Authivara implements a multi-tier testing strategy designed to provide fast, deterministic feedback in CI while enabling live end-to-end ledger verification against the real Stellar Testnet.

| Test Suite | Purpose | Execution Mode | Network Access |
|---|---|---|---|
| **Cryptographic & Hash Tests** | SHA-256 derivation, canonical JSON serialization, Web Worker fallback. | Fast local execution | None |
| **Policy & Security Tests** | MIME magic bytes, file upload policies, duplicate detection, config validation. | Fast local execution | None |
| **Stellar Provider Unit Tests** | `StellarAnchorProvider` transaction building, XDR encoding, operation verification. | Mock Horizon client | None |
| **End-to-End Provenance Tests** | Full file hash -> anchor -> positive verify -> tamper detect cycle. | Local integration | None |
| **Live Stellar Testnet Verification** | Ephemeral keypair creation, Friendbot funding, live `manageData` anchor, Horizon query. | Live CLI script | Active Stellar Testnet |
| **Soroban Contract Tests** | Rust contract tests in `contracts/proof_anchor/` for authorization, deduplication, revocation. | Cargo test runner | Local simulation |

---

## 2. Test Execution Commands

### Run Root Test Suite (All Workspaces):
```bash
npm test
```

### Run API Workspace Tests Specifically:
```bash
npm test --workspace @authivara/api
```

### Run Full Test Suite Across Workspaces:
```bash
npm run test:all
```

### Execute Live Stellar Testnet Verification:
```bash
npm run test:stellar:live
```

### Run Soroban Smart Contract Tests (Requires Rust/Cargo):
```bash
cd contracts/proof_anchor
cargo test
```

### Full TypeScript Build & Typecheck:
```bash
npm run build:all
```

---

## 3. Key Test Suites Explained

### `apps/api/test/stellar-provider.test.ts`
Tests the real `@stellar/stellar-sdk` `TransactionBuilder` and `Operation.manageData` logic using a mock Horizon server:
- Confirms signed transactions are produced with key `authivara-proof:<proof-id>` and value as 64-char hex digest.
- Asserts that `verifyProof` returns `true` for matching digest and `false` for altered digest.
- Asserts strict proof-ID binding prevents cross-proof forgery.
- Validates that malformed digests (non-hex or wrong length) and malformed transaction hashes are rejected before network requests.
- Asserts Horizon 404s and network failures are safely caught and return `false` without crashing the process.
- Validates that an account public key mismatching the secret seed throws immediately during initialization.
- Validates base fee queries in XLM.

### `apps/api/test/provenance-verification-e2e.test.ts`
Exercises the complete end-to-end evidence lifecycle:
1. Derives SHA-256 fingerprint from arbitrary document bytes.
2. Proves identical file copies yield identical digests.
3. Proves a single modified byte produces an avalanche effect resulting in a non-matching digest.
4. Serializes metadata canonically to guarantee consistent cryptographic hashes regardless of object key order.
5. Emits proof record with unique proof ID (`PCA-...`).
6. Submits Stellar `manageData` anchor.
7. Queries verification: original file succeeds (`MATCH`).
8. Queries verification: altered file fails (`NO_MATCH`).
9. Queries verification: version 2 documents are verified without invalidating version 1 history.

### `scripts/verify-stellar-testnet.ts`
An executable script that tests against the live public Stellar network:
1. Generates an ephemeral keypair via `Keypair.random()`.
2. Requests 10,000 test XLM from Friendbot at `https://friendbot.stellar.org`.
3. Submits a real signed transaction to `https://horizon-testnet.stellar.org`.
4. Polls and parses the transaction operations from Horizon.
5. Verifies positive match on original file bytes.
6. Verifies tamper rejection on altered file bytes.
7. Outputs clickable StellarExpert transaction URL.
