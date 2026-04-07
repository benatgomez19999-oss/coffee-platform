/*
  Warnings:

  - The values [SENT_TO_LAB] on the enum `LotDraftStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LotDraftStatus_new" AS ENUM ('PENDING', 'SAMPLE_REQUESTED', 'IN_REVIEW', 'VERIFIED', 'REJECTED');
ALTER TABLE "ProducerLotDraft" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ProducerLotDraft" ALTER COLUMN "status" TYPE "LotDraftStatus_new" USING ("status"::text::"LotDraftStatus_new");
ALTER TYPE "LotDraftStatus" RENAME TO "LotDraftStatus_old";
ALTER TYPE "LotDraftStatus_new" RENAME TO "LotDraftStatus";
DROP TYPE "LotDraftStatus_old";
ALTER TABLE "ProducerLotDraft" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
