# Contributing to Authivara

Thank you for contributing to Authivara. Authivara is built to provide verifiable, privacy-preserving proof of content authorship and digital evidence provenance anchored to the Stellar network.

---

## 1. Core Principles

1. **Document Integrity over Speculation**: Authivara records cryptographic evidence of existence at a specific time. We do not tokenize copyright, mint speculative NFTs, or upload proprietary files to public blockchains.
2. **On-Chain / Off-Chain Separation**: Original file bytes and confidential metadata MUST remain strictly off-chain in private, encrypted object storage. Only deterministic 64-character SHA-256 digests may be anchored to Stellar.
3. **Evidence-Based Documentation**: Every claim in documentation must correspond to executable, testable software. Do not document planned features as already functioning.
4. **Zero Secret Leakage**: Stellar signing seeds (`S...`), database credentials, and KMS keys must never be committed, logged, or sent to client browsers.

---

## 2. Development Prerequisites

- **Node.js**: 22.x or 24.x LTS
- **npm**: 10.x or newer
- **PostgreSQL**: 14+ (for API database persistence)
- **Rust / Cargo** (optional, for Soroban contract development in `contracts/proof_anchor`)

---

## 3. Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Tundeakinbami-dev/Authivara.git
   cd Authivara
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   ```

4. **Prepare Database:**
   ```bash
   npm run prisma:generate
   ```

5. **Run Tests:**
   ```bash
   npm test
   npm test --workspace @authivara/api
   ```

6. **Build All Workspaces:**
   ```bash
   npm run build:all
   ```

---

## 4. Stellar Contribution Guidelines

- **Use Official SDKs**: Use `@stellar/stellar-sdk` and supported Soroban SDK versions.
- **Network Safety**: Development and CI must always target **Stellar Testnet** (`Test SDF Network ; September 2015`). Never hardcode mainnet seeds or deploy unverified code with real funds.
- **Deterministic CI**: CI tests must use mocked Horizon clients to guarantee hermetic, non-flaky test execution.
- **Live Testnet Script**: When modifying Stellar integration, test with `npm run test:stellar:live` to verify real-world ledger confirmation and Horizon response parsing.

---

## 5. Security & PR Checklist

Before opening a pull request, ensure:

- [ ] All automated tests pass (`npm run test:all`).
- [ ] Both Next.js and API workspaces build with zero TypeScript errors (`npm run build:all`).
- [ ] No `.env`, secret seeds, API keys, or private files are tracked (`git status`).
- [ ] File uploads continue to enforce size limits, MIME magic-byte checks, and off-chain storage.
- [ ] Documentation updates reflect changes made to API routes or Stellar operations.
