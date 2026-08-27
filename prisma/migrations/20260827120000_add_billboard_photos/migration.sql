-- AlterEnum
ALTER TYPE "ApprovalType" ADD VALUE 'EDIT_BILLBOARD';
ALTER TYPE "ApprovalType" ADD VALUE 'EDIT_CLIENT';
ALTER TYPE "ApprovalType" ADD VALUE 'DELETE_PHOTO';

-- AlterTable
ALTER TABLE "Billboard" DROP COLUMN "currentPhotoUrl";

-- CreateTable
CREATE TABLE "BillboardPhoto" (
    "id" TEXT NOT NULL,
    "billboardId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillboardPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillboardPhoto_filename_key" ON "BillboardPhoto"("filename");

-- CreateIndex
CREATE INDEX "BillboardPhoto_billboardId_idx" ON "BillboardPhoto"("billboardId");

-- AddForeignKey
ALTER TABLE "BillboardPhoto" ADD CONSTRAINT "BillboardPhoto_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
