# Threat model and control plan

## Assets

- Private original content and optional encrypted vault objects
- File digests, metadata, certificates, provenance events, and Merkle paths
- User identity evidence and organisation membership
- Server signing keys and chain-wallet keys
- Licence contracts, billing records, API keys, and audit logs

## Trust boundaries

The original file starts inside the browser. Hashing must occur locally by default. Browser-to-API traffic, proof API-to-database traffic, queue messages, KMS operations, anchor-worker submissions, and public verification are separate trust boundaries with distinct credentials and policies.

## Primary threats and mitigations

| Threat | Required mitigation |
| --- | --- |
| A user registers stolen work first | Describe the record only as account submission and file existence; retain identity assurance and supporting evidence; provide dispute/supersession events without rewriting history. |
| Original content leaks during hashing | Local Web Worker hashing; CSP and dependency pinning; no analytics on the registration route; automated network test proving file bytes are never sent. |
| Metadata or timestamp is changed later | Canonical envelope signing, append-only events, Merkle anchoring, immutable receipt storage, and independent verifier. |
| Server invents an earlier time | Chain-confirmed batch timestamps, optional RFC 3161 timestamping, externally witnessed daily transparency roots, and explicit display of submitted/anchored/finalised times. |
| Tenant data is exposed | Database RLS, scoped repository methods, access-control integration tests, per-tenant encryption context, and audit alerts. |
| Signing or wallet key is stolen | KMS/HSM non-exportable keys, isolated worker identity, transaction allow-lists, low-balance hot wallet, rotation, and incident revocation records. |
| Public verification is enumerated | Unpredictable share tokens, minimal public metadata, rate limiting, robots controls, expiry/revocation for private links, and user-controlled visibility. |
| Malicious files attack the client | Never render originals directly; sandbox previews; type/size validation; explicit vault scans; avoid server-side parsing during ordinary hashing. |
| Account takeover corrupts provenance | Passkeys/MFA, risk-based reauthentication for transfer/licensing, session management, approval rules, and non-destructive correction events. |
| Blockchain becomes unavailable or unsuitable | Provider abstraction, portable certificates, full inclusion receipts, multi-anchor policy, and chain migration events that preserve the original anchor. |

## Abuse and dispute handling

Proof registration must not be a race-to-ownership mechanism. Reports create a signed dispute event; they do not erase the underlying historical timestamp. Public pages should show disputed, superseded, revoked-key, or compromised-account status. Staff actions require reason codes and dual approval for high-risk changes.

## Release gates

Before a live evidentiary claim is made: independent cryptography review, tenant-isolation penetration test, restore exercise, KMS recovery drill, anchoring reconciliation test, privacy impact assessment for initial launch countries, incident response tabletop, and legal review of every certificate and public-page claim.
