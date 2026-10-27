# Local Development Guide: Authivara

**Target Platform:** Node.js 22+ / 24+ LTS  
**Workspaces:** Root (Next.js 16 Web) + `apps/api` (Fastify 5 API) + `contracts/proof_anchor` (Soroban Smart Contract)

---

## 1. Prerequisites

- **Node.js**: `v22.0.0` or newer (v24 LTS recommended)
- **npm**: `v10.0.0` or newer
- **PostgreSQL**: `v14+` running locally or via Docker
- **Rust & Cargo** (optional, only needed for compiling Soroban contracts)

---

## 2. Initial Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/Tundeakinbami-dev/Authivara.git
   cd Authivara
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   ```

4. **Initialize Database Schema:**
   Ensure PostgreSQL is running, then generate and push the Prisma schema:
   ```bash
   npm run prisma:generate
   ```

---

## 3. Running Services

### Start Next.js Web Application:
```bash
npm run dev
```
The frontend starts at `http://localhost:4173`.

### Start Fastify API Server:
```bash
npm run dev:api
```
The API server starts at `http://localhost:4000`.

### Health Check:
To verify the API and active anchoring network:
```bash
curl http://localhost:4000/health/ready
# Expected: {"status":"ready","anchoringNetwork":"Stellar Testnet"}
```

---

## 4. Configuring Stellar Testnet for Development

To enable live Stellar Testnet anchoring during development:

1. Generate a Testnet account using Stellar Laboratory or Friendbot:
   ```bash
   node -e "
   import('@stellar/stellar-sdk').then(async ({ Keypair }) => {
     const kp = Keypair.random();
     console.log('ACCOUNT:', kp.publicKey());
     console.log('SECRET:', kp.secret());
     await fetch('https://friendbot.stellar.org?addr=' + kp.publicKey());
     console.log('Funded!');
   });"
   ```

2. Set the generated credentials in `apps/api/.env`:
   ```env
   ANCHOR_PROVIDER=stellar
   STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
   STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
   STELLAR_ANCHOR_ACCOUNT="GA..."
   STELLAR_ANCHOR_SECRET="SA..."
   ANCHOR_EXPLORER_URL="https://stellar.expert/explorer/testnet/tx"
   ```

3. Test the live connection:
   ```bash
   npm run test:stellar:live
   ```

---

## 5. Repository Structure

```text
Authivara/
├── app/                          # Next.js App Router (UI routes, verifier pages)
├── apps/
│   └── api/                      # Fastify API workspace
│       ├── prisma/               # Database schema & migrations
│       ├── src/
│       │   ├── modules/
│       │   │   ├── audit/        # SHA-256 tamper-evident audit logs
│       │   │   ├── auth/         # Session cookies, password, magic link, OIDC
│       │   │   ├── blockchain/   # StellarAnchorProvider & provider interfaces
│       │   │   ├── certificates/ # PDF certificate generation with QR codes
│       │   │   ├── content/      # Content entities, versions, AI metadata
│       │   │   ├── provenance/   # Proof registration, metadata hashing
│       │   │   ├── uploads/      # S3 vault storage, policy, malware scanning
│       │   │   ├── users/        # Creator profile, verification levels
│       │   │   └── verification/ # Multi-tenant public & shared verification
│       │   ├── shared/           # Crypto utils, error classes, request context
│       │   └── app.ts            # Fastify application bootstrap
│       └── test/                 # API unit & integration tests
├── contracts/
│   └── proof_anchor/             # Soroban Smart Contract (Rust / WASM)
├── docs/                         # Architecture, Security, Testing, Stellar specs
├── scripts/                      # Live Stellar Testnet verification scripts
├── src/                          # Shared frontend components, API client, crypto
└── package.json                  # Root monorepo workspace configuration
```
