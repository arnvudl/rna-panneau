-- CreateEnum
CREATE TYPE "ContractFace" AS ENUM ('FACE_1', 'FACE_2', 'BOTH');

-- AlterEnum
ALTER TYPE "ApprovalType" ADD VALUE 'DELETE_CLIENT';

-- AlterTable
ALTER TABLE "Billboard" ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "contactInfo",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "face" "ContractFace" NOT NULL DEFAULT 'BOTH';

-- CreateTable
CREATE TABLE "CityPrefix" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,

    CONSTRAINT "CityPrefix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CityPrefix_city_key" ON "CityPrefix"("city");
