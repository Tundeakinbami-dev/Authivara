# Production Deployment Guide: Authivara

**Document Version:** 1.0.0  
**Target Environments:** Cloud Containers (AWS ECS / Fly.io / GCP Cloud Run / Kubernetes) + Managed PostgreSQL + S3 Object Storage + Stellar Network

---

## 1. Production Architecture Units

```text
[ Client Traffic ] ──► [ CDN / Edge WAF ]
                              │
             ┌────────────────┴────────────────┐
             ▼                                 ▼
   [ Web: Next.js Standalone ]        [ API: Fastify Stateless ]
   - Port 4173 (Internal)             - Port 4000 (Internal)
   - Static Asset Caching             - CORS restricted to App Origin
                                               │
                      ┌────────────────────────┼────────────────────────┐
                      ▼                        ▼                        ▼
           [ PostgreSQL 14+ ]      [ Private S3 Vault ]       [ Stellar Horizon ]
           - SSL / TLS enforced    - Block Public Access      - Anchoring Account
           - Daily backups         - KMS Server-Side Encrypt  - Key in Secrets Mgr
```

---

## 2. Production Safety Gates

Authivara's configuration loader (`apps/api/src/config.ts`) enforces strict runtime checks when `NODE_ENV=production`:

1. **Sandbox Provider Forbidden**: Startup fails immediately if `ANCHOR_PROVIDER=sandbox`.
2. **`__Host-` Cookie Prefix Enforced**: `SESSION_COOKIE_NAME` must start with `__Host-` to ensure same-site, HTTPS-only, path-restricted session cookies.
3. **Malware Scanner Required**: `MALWARE_SCANNER_URL` must be configured to screen uploads before registration.
4. **Email Delivery Required**: `EMAIL_DELIVERY_URL` must be set for magic-link delivery and critical alerts.
5. **Stellar Key Consistency**: `STELLAR_ANCHOR_ACCOUNT` and `STELLAR_ANCHOR_SECRET` must be present and cryptographically consistent.

---

## 3. Secret Management & Key Best Practices

- **Never commit `.env` files**: All secrets must be injected at container runtime using AWS Secrets Manager, HashiCorp Vault, or cloud provider environment secrets.
- **Stellar Anchor Account Isolation**:
  - Use a dedicated Stellar account exclusively for anchoring proofs.
  - Maintain a low XLM balance (e.g. 50–100 XLM on Mainnet, or testnet faucet funds) sufficient only for base reserves and transaction fees.
  - Do not use this account for receiving customer payments or holding treasury reserves.
  - Restrict account signers or employ multi-signature signing for high-security enterprise tiers.

---

## 4. Build Artifacts

### 1. Build Web Application:
```bash
npm run build
# Outputs standalone Next.js server in .next/standalone
```

### 2. Build API Application:
```bash
npm run build:api
# Compiles TypeScript into apps/api/dist/
```

### 3. Run Production API Process:
```bash
node apps/api/dist/server.js
```

---

## 5. Mainnet Readiness Considerations

Before transitioning from Stellar Testnet to Stellar Mainnet:

1. **Update Horizon URL & Passphrase**:
   ```env
   STELLAR_HORIZON_URL=https://horizon.stellar.org
   STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; July 2015"
   ANCHOR_EXPLORER_URL=https://stellar.expert/explorer/public/tx
   ```
2. **Fund Dedicated Mainnet Keypair**: Minimum base reserve is 1 XLM per account plus 0.5 XLM per data entry.
3. **Data Retention & Archival**: Historical proofs remain permanently on the Stellar ledger history. Ensure database point-in-time recovery (PITR) is enabled.
