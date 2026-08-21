-- Standards-neutral creator disclosures and rights metadata.
CREATE TYPE "AiContentOrigin" AS ENUM ('HUMAN_CREATED', 'AI_ASSISTED', 'AI_GENERATED', 'AI_EDITED', 'UNKNOWN');

ALTER TABLE "CreatorProfile"
  ADD COLUMN "verificationLevel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "verificationProvider" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3);

ALTER TABLE "License"
  ADD COLUMN "impressions" INTEGER,
  ADD COLUMN "modificationPermission" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "resalePermission" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiTrainingPermission" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ContentAiMetadata" (
  "id" UUID NOT NULL,
  "contentId" UUID NOT NULL,
  "origin" "AiContentOrigin" NOT NULL,
  "toolName" TEXT,
  "modelName" TEXT,
  "creationNotes" TEXT,
  "editingNotes" TEXT,
  "humanContributionNotes" TEXT,
  "independentlyVerified" BOOLEAN NOT NULL DEFAULT false,
  "disclosureSource" TEXT NOT NULL DEFAULT 'CREATOR_PROVIDED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentAiMetadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LicenseTransfer" (
  "id" UUID NOT NULL,
  "licenseId" UUID NOT NULL,
  "fromLicensee" TEXT NOT NULL,
  "toLicensee" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "agreementReference" TEXT,
  "notes" TEXT,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LicenseTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentAiMetadata_contentId_key" ON "ContentAiMetadata"("contentId");
CREATE INDEX "LicenseTransfer_licenseId_effectiveDate_idx" ON "LicenseTransfer"("licenseId", "effectiveDate");

ALTER TABLE "ContentAiMetadata" ADD CONSTRAINT "ContentAiMetadata_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseTransfer" ADD CONSTRAINT "LicenseTransfer_licenseId_fkey"
  FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseTransfer" ADD CONSTRAINT "LicenseTransfer_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
