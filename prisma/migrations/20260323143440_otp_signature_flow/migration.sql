-- DropForeignKey
ALTER TABLE "SignatureToken" DROP CONSTRAINT "SignatureToken_contractId_fkey";

-- AlterTable
ALTER TABLE "SignatureToken" ADD COLUMN     "contractDraft" JSONB,
ADD COLUMN     "mode" TEXT,
ALTER COLUMN "contractId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SignatureToken" ADD CONSTRAINT "SignatureToken_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
