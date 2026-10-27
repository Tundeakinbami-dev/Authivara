# Security Policy and Architecture

**Status:** Active Reference  
**Scope:** Application architecture, cryptographic proof pipelines, Stellar ledger interactions, upload handling, and credential management.

---

## 1. Security Architecture & Threat Mitigations

Authivara implements a defense-in-depth model designed to protect creator intellectual property, confidential documents, and ledger integrity.

| Risk Area | Threat Description | Mitigation in Authivara | Remaining Limitation |
|---|---|---|---|
| **Confidential Document Exposure** | Proprietary documents leaked to public blockchains or unauthorized users. | Original file bytes are **never** transmitted to Stellar or exposed on public verification endpoints. Files reside in private, encrypted S3 object storage accessible only via short-lived signed URLs. | Storage bucket access relies on cloud IAM policy correctness and secure KMS key management. |
| **Low-Entropy File Guessing Attacks** | Standardized documents (e.g., boilerplate NDAs, small invoices) reverse-engineered from public SHA-256 digests via dictionary attacks. | Documents should incorporate creator salt / unique nonce where low-entropy templates are fingerprinted. Authivara computes separate canonical metadata hashes to bind contextual provenance. | Public SHA-256 hashes of publicly known zero-entropy documents can still be precomputed in rainbow tables if no custom salt is added. |
| **Secret Seed & Credential Leakage** | Stellar secret seeds (`S...`), database passwords, or KMS keys exposed in client bundles or public repositories. | Zero secret seeds exist in client bundles. `StellarAnchorProvider` executes strictly inside the protected Fastify API process. Production config enforces `__Host-` session cookies and rejects development fallbacks. | Compromise of the API server host environment could expose environment variables stored in memory. |
| **Broken Object-Level Access Control (BOLA)** | User A requests or mutates proof records or uploads belonging to User B. | Ownership checks are strictly enforced in `UploadService`, `ProvenanceService`, and `ContentService` using the authenticated session context (`request.authUser.id`), never trusting user-supplied body IDs. | Organization role management requires careful permission auditing as teams scale. |
| **Malicious File Uploads** | Attackers upload malware, polyglot files, or oversized payloads to execute attacks or cause DoS. | Client and server enforce strict file size limits (default 2GB), file policy extension whitelists, MIME magic-byte verification (rejecting files whose declared MIME mismatches content), and an anti-malware scanner hook. | Zero-day malware signatures may not be detected by standard scanners before execution. |
| **Transaction Spoofing & Verification Forgery** | Attacker presents arbitrary transaction hashes or claiming verification on unauthorized chains. | `StellarAnchorProvider.verifyProof()` enforces strict SHA-256 regex format, queries official Horizon nodes, checks `transaction.successful === true`, verifies `manage_data` operation names start with `authivara-proof:`, and supports strict `proofId` matching. | Horizon server trust: verification assumes the configured Horizon endpoint provides truthful ledger state. |
| **Replay & Duplicate Proof Attacks** | Re-registering identical works or racing proof submissions. | Database enforces unique content hash and proof ID constraints. Service checks existing public proofs and flags duplicates with clear notice. Soroban contract rejects duplicate proof IDs. | A malicious actor who obtains an unpublished file before the true creator can register a timestamp first (first-to-anchor advantage). |
| **Verification Endpoint Abuse & DoS** | Automated scraping or mass enumeration of public proof IDs or share tokens. | Global rate limiting (Fastify rate limit 120 req/min), HMAC privacy hashing of requester IP addresses (`ipHash`), and unpredictable 128-bit proof IDs (`PCA-<12-hex-chars>`). | Distributed botnets could exhaust public rate limits without API key gating. |

---

## 2. Trust Model & Legal Disclaimer

1. **Integrity vs. Legal Ownership**:
   - A verified Stellar anchor confirms **byte-for-byte integrity and existence at a specific ledger timestamp**.
   - It **does not** constitute a legal determination of copyright ownership, author identity verification, patent validity, or factual veracity of document contents.
2. **Revocation Model**:
   - Proof records can be revoked in the database and Soroban contract by the original issuer. Revocation does not erase the historical transaction on the immutable Stellar ledger, but flags the proof as revoked for all verifiers.

---

## 3. Reporting Vulnerabilities

If you discover a security vulnerability in Authivara, please send a responsible disclosure report to the repository maintainer:

- **Email:** `abidemibabatunde332@gmail.com`
- **PGP / Secure Channel:** Available upon request.

Please do not open public GitHub issues for undisclosed security vulnerabilities.
