-- DropForeignKey
ALTER TABLE "Billboard" DROP CONSTRAINT "Billboard_districtId_fkey";

-- DropForeignKey
ALTER TABLE "Billboard" DROP CONSTRAINT "Billboard_regionId_fkey";

-- AlterTable
ALTER TABLE "Billboard" DROP COLUMN "city",
ALTER COLUMN "districtId" SET NOT NULL,
ALTER COLUMN "regionId" SET NOT NULL;

-- DropTable
DROP TABLE "CityPrefix";

-- AddForeignKey
ALTER TABLE "Billboard" ADD CONSTRAINT "Billboard_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billboard" ADD CONSTRAINT "Billboard_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

