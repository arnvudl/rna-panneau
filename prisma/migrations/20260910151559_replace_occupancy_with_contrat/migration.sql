/*
  Warnings:

  - You are about to drop the `Occupancy` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ContratStatus" AS ENUM ('DRAFT', 'SIGNED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContratFaceSide" AS ENUM ('FACE_1', 'FACE_2', 'BOTH');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'GENEREE', 'ENVOYEE', 'PAYEE', 'IMPAYEE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED', 'RESOLVED');

-- DropForeignKey
ALTER TABLE "Occupancy" DROP CONSTRAINT IF EXISTS "Occupancy_billboardId_fkey";

-- DropForeignKey
ALTER TABLE "Occupancy" DROP CONSTRAINT IF EXISTS "Occupancy_clientId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "caTotalMTD" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "carteF" TEXT,
ADD COLUMN IF NOT EXISTS "detteMTD" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "facturesImpayees" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "firstContractDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nif" TEXT,
ADD COLUMN IF NOT EXISTS "rcs" TEXT,
ADD COLUMN IF NOT EXISTS "stat" TEXT;

-- CreateTable
CREATE TABLE "Contrat" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "billboardId" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateFin" TIMESTAMP(3),
    "typeReconduction" TEXT NOT NULL,
    "statut" "ContratStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT,
    "dateBAT" TIMESTAMP(3),
    "batValidated" BOOLEAN NOT NULL DEFAULT false,
    "batValidatedDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contrat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratFace" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "face" "ContratFaceSide" NOT NULL DEFAULT 'BOTH',
    "tarifMensuel" DOUBLE PRECISION,
    "tarifSemestriel" DOUBLE PRECISION,
    "tarifAnnuel" DOUBLE PRECISION,
    "dateImpressionDebut" TIMESTAMP(3),
    "dateImpressionFin" TIMESTAMP(3),
    "typeImpression" TEXT,
    "jourAlerte" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratFace_pkey" PRIMARY KEY ("id")
);

-- DataMigration: copy every existing Occupancy row into Contrat + ContratFace
-- before Occupancy is dropped. Each Occupancy row produces exactly one Contrat
-- row (id preserved) and one ContratFace row.
INSERT INTO "Contrat" (id, numero, type, "clientId", "billboardId", "dateDebut", "dateFin", "typeReconduction", statut, "createdAt", "updatedAt")
SELECT
  id,
  COALESCE("contractRef", 'CT-' || id),
  'contrat',
  "clientId",
  "billboardId",
  "startDate",
  "endDate",
  'tacite',
  (CASE WHEN status = 'ACTIVE' THEN 'ACTIVE' ELSE 'ENDED' END)::"ContratStatus",
  "createdAt",
  "createdAt"
FROM "Occupancy";

INSERT INTO "ContratFace" (id, "contratId", face, "jourAlerte", "createdAt")
SELECT
  gen_random_uuid()::text,
  id,
  face::text::"ContratFaceSide",
  7,
  "createdAt"
FROM "Occupancy";

-- DropTable
DROP TABLE "Occupancy";

-- DropEnum
DROP TYPE "OccupancyFace";

-- DropEnum
DROP TYPE "OccupancyStatus";

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "genereeAt" TIMESTAMP(3),
    "genereeBy" TEXT,
    "pdfUrl" TEXT,
    "montantTotal" DOUBLE PRECISION NOT NULL,
    "montantTaxe" DOUBLE PRECISION NOT NULL,
    "montantNet" DOUBLE PRECISION NOT NULL,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "statut" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "dernierRelanceDate" TIMESTAMP(3),
    "relanceCount" INTEGER NOT NULL DEFAULT 0,
    "alerteImpayee" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLigne" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contratId" TEXT,
    "montantHT" DOUBLE PRECISION NOT NULL,
    "tauxTaxe" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "montantTTC" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLigne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "dateReception" TIMESTAMP(3) NOT NULL,
    "modePayement" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "relatedType" TEXT NOT NULL,
    "clientId" TEXT,
    "statut" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "dateAlert" TIMESTAMP(3) NOT NULL,
    "dateEnvoi" TIMESTAMP(3),
    "dateLecture" TIMESTAMP(3),
    "envoiEmail" BOOLEAN NOT NULL DEFAULT true,
    "envoiApp" BOOLEAN NOT NULL DEFAULT true,
    "envoiClient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contrat_numero_key" ON "Contrat"("numero");

-- CreateIndex
CREATE INDEX "Contrat_clientId_idx" ON "Contrat"("clientId");

-- CreateIndex
CREATE INDEX "Contrat_billboardId_idx" ON "Contrat"("billboardId");

-- CreateIndex
CREATE INDEX "ContratFace_contratId_idx" ON "ContratFace"("contratId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_numero_key" ON "Invoice"("numero");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "InvoiceLigne_invoiceId_idx" ON "InvoiceLigne"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Alert_clientId_idx" ON "Alert"("clientId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "Billboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratFace" ADD CONSTRAINT "ContratFace_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLigne" ADD CONSTRAINT "InvoiceLigne_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
