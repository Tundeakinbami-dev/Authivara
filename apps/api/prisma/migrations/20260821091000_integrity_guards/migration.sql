-- Cryptographic fields are constrained to lowercase SHA-256 hex where applicable.
ALTER TABLE "Content" ADD CONSTRAINT "Content_contentHash_sha256" CHECK ("contentHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_hash_sha256" CHECK ("hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "ProvenanceRecord" ADD CONSTRAINT "ProvenanceRecord_hash_sha256" CHECK ("hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_submittedHash_sha256" CHECK ("submittedHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_eventHash_sha256" CHECK ("eventHash" ~ '^[0-9a-f]{64}$');

-- Historical audit facts are append-only. A user reference may be anonymized and a
-- detached KMS signature may be attached, but recorded event facts cannot change.
CREATE OR REPLACE FUNCTION authivara_protect_audit_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AuditLog rows are append-only';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR (NEW."organizationId" IS DISTINCT FROM OLD."organizationId" AND NEW."organizationId" IS NOT NULL)
    OR NEW."action" IS DISTINCT FROM OLD."action"
    OR NEW."resource" IS DISTINCT FROM OLD."resource"
    OR NEW."resourceId" IS DISTINCT FROM OLD."resourceId"
    OR NEW."timestamp" IS DISTINCT FROM OLD."timestamp"
    OR NEW."metadata" IS DISTINCT FROM OLD."metadata"
    OR NEW."previousHash" IS DISTINCT FROM OLD."previousHash"
    OR NEW."eventHash" IS DISTINCT FROM OLD."eventHash"
    OR (NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."userId" IS NOT NULL)
    OR (OLD."signature" IS NOT NULL AND NEW."signature" IS DISTINCT FROM OLD."signature")
  THEN
    RAISE EXCEPTION 'Recorded AuditLog facts cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "AuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION authivara_protect_audit_event();
