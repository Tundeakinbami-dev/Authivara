# Authivara Soroban Proof Anchor Contract

This directory contains the **Soroban Smart Contract** implementation for Authivara's decentralized proof anchoring.

## Overview

Authivara primarily utilizes **Stellar Native `manageData` operations** for timestamping content proofs due to:
- Direct ledger persistence without smart contract VM execution overhead.
- Ultra-low transaction fees (~100 stroops / 0.00001 XLM).
- Direct queryability via public Stellar Horizon instances without state archive expiration issues.

This **Soroban Smart Contract** is provided as an alternative, advanced engine for institutional and multi-party deployments where on-chain governance, contract-enforced access controls, or verifiable on-chain revocation is required.

## Capabilities

1. **`register_proof(issuer, proof_id, content_hash, metadata_hash, version)`**:
   - Requires cryptographic signature from the `issuer` address (`issuer.require_auth()`).
   - Rejects duplicate registrations for the same `proof_id`.
   - Stores the SHA-256 content digest (32 bytes) and canonical metadata hash in persistent contract storage.
   - Sets and extends contract storage TTL.
   - Emits a Soroban event `(symbol_short!("registered"), issuer, proof_id)`.

2. **`verify_proof(proof_id, candidate_hash)`**:
   - Returns `true` only if the proof exists, is unrevoked, and the `candidate_hash` exactly matches the recorded `content_hash`.
   - Returns `false` for tampered files, non-existent proofs, or revoked proofs.

3. **`get_proof(proof_id)`**:
   - Returns the full `ProofRecord` tuple containing issuer address, hashes, ledger timestamp, version, and revocation status.

4. **`revoke_proof(issuer, proof_id)`**:
   - Restricts revocation exclusively to the original `issuer` address.
   - Marks the proof as revoked, preventing future positive verification matches while preserving immutable history.

## Building and Testing

Requirements: Rust with `wasm32-unknown-unknown` target and `cargo`.

```bash
# Run unit tests
cargo test

# Build optimized WebAssembly contract
cargo build --target wasm32-unknown-unknown --release
```
