-- CreateIndex
CREATE INDEX "ApprovalRequest_requestedById_idx" ON "ApprovalRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ApprovalRequest_reviewedById_idx" ON "ApprovalRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "Contract_billboardId_idx" ON "Contract"("billboardId");

-- CreateIndex
CREATE INDEX "Contract_clientId_idx" ON "Contract"("clientId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_billboardId_idx" ON "MaintenanceRecord"("billboardId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_technicianId_idx" ON "MaintenanceRecord"("technicianId");
