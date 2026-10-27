# Stellar Integration Specification

**Ledger:** Stellar Consensus Protocol (SCP)  
**SDK:** `@stellar/stellar-sdk` (v17.x)  
**Primary Operation:** Native `manageData` (Account Data Entry)  
**Alternative Engine:** Soroban Smart Contract (`contracts/proof_anchor/`)  

---

## 1. Executive Summary

Authivara anchors content fingerprints directly to the Stellar network to provide an immutable, decentralized, timestamped witness of existence.

By anchoring exclusively the **64-character SHA-256 hex digest**, Authivara guarantees that:
- No proprietary content, confidential contracts, or creator files are leaked to the public blockchain.
- Any auditor or counterparty can independently verify a file against the Stellar ledger using standard HTTP tools without trusting Authivara's API.
- Anchoring is extremely cost-effective (~0.00001 XLM per proof) and achieves deterministic SCP finality in 3–5 seconds.

---

## 2. On-Chain Ledger Footprint

### Native `manageData` Operation Format

```text
Transaction Envelope:
  Source Account:   <STELLAR_ANCHOR_ACCOUNT (G...)>
  Base Fee:         100 Stroops (0.00001 XLM)
  Timeout:          60 seconds
  Network:          Stellar Testnet / Mainnet
  Operations:
    1. manageData:
       Name:        "authivara-proof:<proof-id>"  (e.g., "authivara-proof:PCA-72C2725E5D07")
       Value:       "<64-char lowercase SHA-256>"  (e.g., "72c2725e5d07a2f6830725564deb146c608bbd723f0765bdb703622f5c95e4fa")
```

- **Name Constraint**: Up to 64 bytes in Stellar XDR. Authivara prefix `authivara-proof:` (16 bytes) + `PCA-` (4 bytes) + 12 hex chars (12 bytes) = 32 bytes total (fits well within limit).
- **Value Constraint**: Up to 64 bytes in Stellar XDR. A 64-character hexadecimal SHA-256 string is exactly 64 bytes.

---

## 3. Independent Verification Procedure (Without Authivara API)

Any third party holding a candidate document and a Stellar transaction hash can independently verify the proof using standard terminal tools.

### Step 1: Compute Local Document Fingerprint
```bash
# On Linux / macOS:
sha256sum original_work.pdf

# On Windows (PowerShell):
(Get-FileHash -Algorithm SHA256 original_work.pdf).Hash.ToLower()
```
*Example Output:* `72c2725e5d07a2f6830725564deb146c608bbd723f0765bdb703622f5c95e4fa`

### Step 2: Query Horizon for Transaction Operations
```bash
curl -s "https://horizon-testnet.stellar.org/transactions/<TRANSACTION_HASH>/operations"
```

### Step 3: Inspect the `manage_data` Record
In the JSON response, locate the operation with:
- `"type": "manage_data"`
- `"name": "authivara-proof:<proof-id>"`
- Base64-decode the `"value"` field.

```bash
# Example decoding with node:
node -e "console.log(Buffer.from('<BASE64_VALUE>', 'base64').toString('utf8'))"
```

### Step 4: Compare
If the decoded string matches the local SHA-256 fingerprint bit-for-bit:
- **Result:** Integrity verified. The identical byte sequence existed at or before the ledger closed time recorded on Stellar.

---

## 4. Explorer Verification

Every recorded proof in Authivara generates a direct link to the transaction on StellarExpert:
- **Testnet Explorer:** `https://stellar.expert/explorer/testnet/tx/<TRANSACTION_HASH>`
- **Public Explorer:** `https://stellar.expert/explorer/public/tx/<TRANSACTION_HASH>`

---

## 5. Soroban Smart Contract Architecture

For deployments requiring decentralized governance, multi-party issuance, or on-chain revocation voting, Authivara provides a Soroban smart contract in [`contracts/proof_anchor/`](../contracts/proof_anchor/):

- **`register_proof(issuer, proof_id, content_hash, metadata_hash, version)`**: Requires issuer cryptographic signature and emits on-chain event.
- **`verify_proof(proof_id, candidate_hash)`**: Returns boolean verifying match against persistent storage.
- **`revoke_proof(issuer, proof_id)`**: Issuer-only revocation preserving audit history.

See [`contracts/proof_anchor/README.md`](../contracts/proof_anchor/README.md) for build instructions.

---

## 6. Live Testnet Demonstration

A live demonstration script is included:
```bash
npm run test:stellar:live
```

This script:
1. Generates an ephemeral Testnet keypair.
2. Funds the account via Friendbot (`https://friendbot.stellar.org`).
3. Signs and submits a live transaction to Horizon.
4. Queries Horizon to verify positive match on the original document.
5. Queries Horizon to verify tamper rejection on modified bytes.
