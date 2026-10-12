# Stellar proof anchoring

Authivara stores a SHA-256 fingerprint of a work and uses a native Stellar Testnet `manageData` operation as a public, independently retrievable timestamped anchor. The operation has a key in the form `authivara-proof:<proof-id>` and a value containing exactly the 64-character lower-case SHA-256 hex digest.

No file bytes, filenames, titles, account identities, metadata hashes, or secrets are sent to Stellar. The transaction hash is stored with the proof. During verification the API requests the transaction and its operations from Horizon, confirms the transaction succeeded, and compares the decoded `manage_data` value to the submitted digest.

## Configure Testnet

Create and fund a dedicated Testnet account, then configure the API environment:

```bash
ANCHOR_PROVIDER=stellar
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
STELLAR_ANCHOR_ACCOUNT=G...
STELLAR_ANCHOR_SECRET=S...
ANCHOR_EXPLORER_URL=https://stellar.expert/explorer/testnet/tx
```

`STELLAR_ANCHOR_ACCOUNT` must correspond to the supplied secret seed. Keep the seed in a secrets manager; it must never be exposed to a browser or committed to this repository. The funding account needs XLM for Stellar base reserves and transaction fees.

## Evidence to inspect

After registering a proof, the API stores the Stellar transaction hash and ledger number. Open the transaction in a Testnet explorer or request its operations from Horizon. A valid Authivara anchor has a successful transaction and a `manage_data` operation whose key begins with `authivara-proof:` and whose base64-decoded value equals the proof's SHA-256 digest.

The automated Stellar provider tests mock Horizon rather than submitting a live transaction, so tests are deterministic and never require a funded account.

## Limits

This is a per-proof Testnet transaction, suitable for development and demonstrable verification. It does not batch proofs, wait for a configurable finality depth, rotate signing keys, or use Stellar Mainnet. A proof records an account-submitted fingerprint at a time; it is not copyright registration, a legal ownership decision, or identity verification.
