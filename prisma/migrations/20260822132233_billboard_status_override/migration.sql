-- CreateEnum
CREATE TYPE "BillboardStatus" AS ENUM ('AVAILABLE', 'RENTED', 'EXPIRING_SOON', 'EXPIRED', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "Billboard" ADD COLUMN     "statusOverride" "BillboardStatus";
