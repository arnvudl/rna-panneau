-- Reconcile enum variants that were applied directly to the database
-- without a migration file (pre-existing drift). Idempotent so this is a
-- no-op on databases that already have them.
ALTER TYPE "ApprovalType" ADD VALUE IF NOT EXISTS 'EDIT_BILLBOARD';
ALTER TYPE "ApprovalType" ADD VALUE IF NOT EXISTS 'EDIT_CLIENT';
ALTER TYPE "ApprovalType" ADD VALUE IF NOT EXISTS 'DELETE_PHOTO';

-- AlterTable
ALTER TABLE "Billboard" ADD COLUMN     "communeId" TEXT,
ADD COLUMN     "districtId" TEXT,
ADD COLUMN     "regionId" TEXT,
ALTER COLUMN "city" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commune" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE INDEX "District_regionId_idx" ON "District"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "District_regionId_name_key" ON "District"("regionId", "name");

-- CreateIndex
CREATE INDEX "Commune_districtId_idx" ON "Commune"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "Commune_districtId_name_key" ON "Commune"("districtId", "name");

-- CreateIndex
CREATE INDEX "Billboard_regionId_idx" ON "Billboard"("regionId");

-- CreateIndex
CREATE INDEX "Billboard_districtId_idx" ON "Billboard"("districtId");

-- CreateIndex
CREATE INDEX "Billboard_communeId_idx" ON "Billboard"("communeId");

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commune" ADD CONSTRAINT "Commune_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billboard" ADD CONSTRAINT "Billboard_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billboard" ADD CONSTRAINT "Billboard_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billboard" ADD CONSTRAINT "Billboard_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;

