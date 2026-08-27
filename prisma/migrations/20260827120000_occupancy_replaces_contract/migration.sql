-- CreateEnum
CREATE TYPE "OccupancyStatus" AS ENUM ('ACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "OccupancyFace" AS ENUM ('FACE_1', 'FACE_2', 'BOTH');

-- AlterEnum
BEGIN;
CREATE TYPE "ApprovalType_new" AS ENUM ('CREATE_OCCUPANCY', 'EDIT_OCCUPANCY', 'DELETE_BILLBOARD', 'DELETE_CLIENT');
ALTER TABLE "ApprovalRequest" ALTER COLUMN "type" TYPE "ApprovalType_new" USING ("type"::text::"ApprovalType_new");
ALTER TYPE "ApprovalType" RENAME TO "ApprovalType_old";
ALTER TYPE "ApprovalType_new" RENAME TO "ApprovalType";
DROP TYPE "public"."ApprovalType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_billboardId_fkey";

-- DropForeignKey
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_clientId_fkey";

-- AlterTable
ALTER TABLE "Billboard" ADD COLUMN     "permitNumber" TEXT,
ADD COLUMN     "taxPaymentRef" TEXT;

-- DropTable
DROP TABLE "Contract";

-- DropEnum
DROP TYPE "ContractFace";

-- DropEnum
DROP TYPE "ContractStatus";

-- CreateTable
CREATE TABLE "Occupancy" (
    "id" TEXT NOT NULL,
    "billboardId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "face" "OccupancyFace" NOT NULL DEFAULT 'BOTH',
    "contractRef" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "status" "OccupancyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Occupancy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Occupancy_billboardId_idx" ON "Occupancy"("billboardId");

-- CreateIndex
CREATE INDEX "Occupancy_clientId_idx" ON "Occupancy"("clientId");

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

