# Threat Model and Security Control Plan

**System:** Authivara Cryptographic Provenance & Proof Verification Engine  
**Target Ledger:** Stellar Consensus Protocol (SCP) / Stellar Testnet & Mainnet  
**Last Updated:** October 2026  

---

## 1. Assets and Valuation

| Asset | Confidentiality | Integrity | Availability | Threat Impact |
|---|---|---|---|---|
| **Original User Documents** | **Critical** | High | High | Severe: Breach of proprietary creative or legal IP. |
| **Content Digests (SHA-256)** | Low (Public) | **Critical** | High | High: Corrupted digest prevents independent verification. |
| **Stellar Anchor Secret Keys** | **Critical** | **Critical** | Medium | Critical: Stolen seed allows transaction fee drainage or rogue anchors. |
| **Database & Audit Logs** | High | **Critical** | High | High: Altered audit log compromises non-repudiation. |
| **Certificate Share Tokens** | High | High | Medium | Medium: Leaked share token allows unauthorized inspection of private proof. |

---

## 2. Trust Boundaries and Data Flow

```text
[ Client Browser / Verifier ]
           │ (HTTPS, TLS 1.3, CSP)
           ▼
[ Fastify API Gateway ] ── (Session Auth, Origin, Rate Limiting)
     │            │
     │            ▼
     │      [ PostgreSQL Database (Prisma ORM) ]
     │            │ (RLS, SHA-256 Audit Chaining)
     │
     ├── (Presigned PUT, KMS SSE) ──► [ Private S3 Object Vault ]
     │
     └── (Official Stellar SDK) ──► [ Stellar Horizon Gateway ]
                                           │ (SCP Consensus)
                                           ▼
                                 [ Stellar Ledger Network ]
```

### Trust Boundary Invariants:
1. **Zero Raw Bytes Across Ledger Boundary**: Original file content never passes into the Stellar network. Only 64-character hexadecimal SHA-256 digests cross into the ledger boundary via native `manageData` operations.
2. **Untrusted Client Inputs**: Client-provided hashes, extensions, MIME types, and filenames are treated as untrusted. Server independently calculates SHA-256 and detects magic bytes before marking an upload `CLEAN`.
3. **Session-Derived Multi-Tenancy**: Organization and user IDs are derived strictly from cryptographically validated sessions, never from request payload parameters.

---

## 3. Threat Matrix & Detailed Control Plan

### 3.1 Ledger & Blockchain Threats

#### T-1: Malicious Ledger Spoofing (Horizon MITM)
- **Threat**: An adversary intercepts API requests to Horizon and reports forged ledger confirmations.
- **Controls**: TLS 1.3 certificate validation on all Horizon endpoints. Configurable trusted Horizon URL. Independent cross-verification supported by third-party explorers (StellarExpert).

#### T-2: Stellar Seed Compromise
- **Threat**: The `STELLAR_ANCHOR_SECRET` seed is exfiltrated from the server environment.
- **Controls**:
  - Seed is only loaded in memory in the backend API process; never transmitted to browsers or written into logs.
  - Dedicated anchor keypair with minimal XLM balance strictly for base reserves and transaction fees (principle of least privilege).
  - Rotation procedures supported via environment variable update without altering historical ledger entries.

#### T-3: Network Congestion & Surge Pricing
- **Threat**: Spikes in Stellar transaction fees cause anchor transactions to time out or exceed fee allocations.
- **Controls**: Dynamic base fee queries via `client.fetchBaseFee()` with configurable transaction timeout (60 seconds). Failed submissions transition proof state to `FAILED` with retry capability.

#### T-4: Data Key Collision on Stellar Ledger
- **Threat**: Two different proofs generate the same `manage_data` key, overwriting prior ledger data entries.
- **Controls**: Proof IDs utilize high-entropy unpredictable identifiers (`PCA-<12 hex characters>`, 48 bits of entropy), namespaced with `authivara-proof:`. Database enforces unique constraints on proof IDs.

---

### 3.2 Document & Cryptographic Threats

#### T-5: Low-Entropy File Guessing Attacks
- **Threat**: A standardized or short document (e.g. standard invoice or NDA template) is anchored publicly. An attacker uses a precomputed dictionary of candidate files to match the SHA-256 digest and determine the document contents.
- **Mitigation & Guidance**:
  - The API warns creators that publicly registered proofs contain public hashes.
  - Creators of standardized forms are advised to embed unique nonces or creator IDs inside documents before hashing.
  - Canonical metadata hashes bind the context (title, category, tags) to the proof record.

#### T-6: First-to-File Authorship Claims (Race to Anchor)
- **Threat**: An unauthorized party intercepts an unreleased work and registers the proof before the true creator.
- **Mitigation & Guidance**:
  - Clear, legally accurate messaging: Authivara records **proof of existence at a time**, not judicial adjudication of copyright.
  - Audit logging records user account, email verification, and IP privacy hashes at time of submission.
  - Future support for dispute and supersession records without rewriting immutable ledger history.

---

## 4. Release Gates & Operational Checklist

- [x] Hermetic automated test suite with deterministic mocks.
- [x] Input validation for all public and private API endpoints using Zod.
- [x] Rate limiting enabled on Fastify server (120 req/minute).
- [x] CORS restricted to configured `APP_ORIGIN`.
- [x] Helmet security headers (nosniff, frameguard, strict CSP).
- [x] No plaintext credentials or secrets in Git history.
- [x] Real-world Testnet verification demonstrated and reproducible.
