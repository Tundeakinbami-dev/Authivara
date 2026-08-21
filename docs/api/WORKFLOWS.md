# API workflows

All JSON mutation routes use secure cookie sessions and require `Origin` to match `APP_ORIGIN` after login.

## Account and profile

- `POST /v1/auth/signup` — creates a user, creator profile, personal organization, owner membership, and session.
- `POST /v1/auth/login`, `POST /v1/auth/logout`, `GET /v1/auth/me` — password session lifecycle.
- `POST /v1/auth/magic-link`, `POST /v1/auth/magic-link/verify` — single-use, 15-minute email login tokens; only token digests are stored.
- `POST /v1/auth/google` — validates a Google OIDC ID token against Google's signed JWKS, issuer, audience, and verified-email claim.
- `GET|PUT /v1/creator-profile` — reads or updates creator-facing metadata.

Production magic-link delivery requires `EMAIL_DELIVERY_URL`; Google login is enabled by `GOOGLE_CLIENT_ID`. Wallet authentication remains an optional future provider. MFA ceremony and recovery endpoints remain release work even though account policy state is represented in the schema.

## Register a work

1. Hash the file locally with SHA-256.
2. `POST /v1/uploads` with `fileName`, `mimeType`, `fileSize`, and optionally the base64 SHA-256 checksum.
3. `PUT` the bytes to the returned signed URL. Track progress with `XMLHttpRequest`; retry only while the URL remains valid. `DELETE /v1/uploads/:id` cancels and removes the object.
4. `POST /v1/uploads/:id/complete` with optional hexadecimal `clientHash`. The API validates the stored bytes, independently hashes them, and scans them.
5. `POST /v1/content/register` with the clean `uploadId`, title, description, category, tags, and visibility.
6. Poll `GET /v1/proofs/:proofId/status` or explicitly reconcile with `POST /v1/proofs/:proofId/refresh`.
7. Fetch the portable JSON certificate at `GET /v1/certificates/:certificateNumber` or the QR-enabled PDF at `GET /v1/certificates/:certificateNumber/pdf`.
8. Create or rotate an expiring capability link with `POST /v1/certificates/:certificateNumber/share`; revoke it with `DELETE` on the same path. The raw token is returned once and only its digest is stored.

The final registration call is idempotent for an upload: repeating it returns the already-created record rather than submitting another anchor. Duplicate byte content is rejected per owner.

## Versions

Upload and complete the new bytes, then call `POST /v1/content/:contentId/versions` with an optional label, description, and tags. The service assigns the next monotonic version number, creates a new proof and certificate, and preserves prior versions. `GET /v1/content/:contentId/versions` returns the history. `GET /v1/content/:contentId/versions/compare?from=1&to=2` compares metadata and reports exact-byte equality only when canonical hashes match.

## Dashboard and content management

- `GET /v1/dashboard/summary` returns the six creator dashboard metrics.
- `PATCH /v1/content/:contentId/archive` archives an authorized work and appends a hash-chained audit event.
- `GET /v1/public/proofs/id/:proofId/certificate.pdf` serves a public certificate only when the work is explicitly public.

## Public verification

- `GET /v1/public/proofs/:shareToken` returns the minimum public certificate/proof envelope.
- `POST /v1/public/proofs/:shareToken/verify` accepts a locally calculated `contentHash` and returns `MATCH`, `NO_MATCH`, or `REVOKED`.
- `GET /v1/public/proofs/id/:proofId` powers the public `/proof/PCA-…` page for explicitly `PUBLIC` content and returns its version/proof timeline.
- `POST /v1/public/verify` accepts a SHA-256 digest and optional proof ID parsed from a proof ID or verification URL. It returns `MATCH`, `RELATED_VERSION`, `NO_MATCH`, `INVALID_PROOF`, or `REVOKED`.

The public endpoint never accepts or returns original content. Share tokens are random and stored only as SHA-256 digests. Public routes are rate limited.
