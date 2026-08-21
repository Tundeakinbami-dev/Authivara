# Hashing, duplicate detection, and verification

## Canonical content fingerprint

The canonical content hash is always SHA-256 over the exact, unmodified file bytes:

```text
Exact file bytes
       ↓
     SHA-256
       ↓
Canonical content fingerprint (64 lowercase hexadecimal characters)
       ↓
ContentVersion + ProvenanceRecord
```

The browser streams the `File` through an incremental SHA-256 implementation in a Web Worker. For a vaulted upload, the API independently streams the stored object through Node's SHA-256 implementation. If the optional client digest and server digest differ, registration stops.

Filename, extension, EXIF metadata, upload timestamp, object key, and file size are **not** inputs to the canonical hash. They may help validate or describe an upload, but they are mutable and cannot establish byte-for-byte identity.

The following values are deliberately distinct:

| Value | Meaning | Canonical file identity? |
| --- | --- | --- |
| `Content.contentHash` / `ContentVersion.hash` | SHA-256 of the exact original bytes | Yes |
| `ProvenanceRecord.hash` | Copy of the version's canonical content hash submitted for anchoring | Yes |
| `metadataHash` | SHA-256 of canonicalized, approved descriptive metadata | No |
| Future normalized-preview hash | Fingerprint of an explicitly derived preview used for similarity/version hints | No |

A normalized preview must never replace or be labelled as the canonical content hash. This implementation does not yet generate preview derivatives; related-version results use exact hashes from registered `ContentVersion` rows.

## Privacy-safe duplicate classification

After the server calculates the canonical hash, it checks existing non-archived content and returns one of:

- `SAME_USER` — the authenticated owner may see their content ID and title.
- `SAME_ORGANIZATION` — an authorized organization member may see the organization work.
- `PUBLIC` — the response may say that the exact file has a prior public proof and provide its public proof ID/title.
- `NONE` — no accessible duplicate is reported.

If the same hash belongs only to another user's private proof, the response is also `NONE`. No account, title, proof ID, creator identity, or confirmation that a private record exists is disclosed.

## Verification results

- `MATCH` — exact SHA-256 match with the selected/public proof.
- `RELATED_VERSION` — exact SHA-256 match with another registered version of the selected work.
- `NO_MATCH` — no accessible exact public proof, or no matching version under the supplied proof.
- `INVALID_PROOF` — the proof ID/URL is malformed, missing, or not publicly available.
- `REVOKED` — bytes matched but the proof or certificate has been revoked.

These results establish technical integrity against a timestamped record. They do not adjudicate authorship, copyright, or competing ownership claims.
