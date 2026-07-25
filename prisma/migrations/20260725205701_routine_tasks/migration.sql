-- CreateEnum
CREATE TYPE "LogSource" AS ENUM ('APP', 'ALFRED');

-- CreateEnum
CREATE TYPE "RecurrenceUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "MaintenanceEntry" ADD COLUMN     "loggedVia" "LogSource" NOT NULL DEFAULT 'APP',
ADD COLUMN     "taskId" TEXT;

-- CreateTable
CREATE TABLE "MaintenanceTask" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "applianceId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "intervalValue" INTEGER NOT NULL,
    "intervalUnit" "RecurrenceUnit" NOT NULL,
    "nextDueOn" TIMESTAMP(3) NOT NULL,
    "lastCompletedOn" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlfredConfirmation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlfredConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceTask_homeId_nextDueOn_idx" ON "MaintenanceTask"("homeId", "nextDueOn");

-- CreateIndex
CREATE INDEX "MaintenanceTask_applianceId_idx" ON "MaintenanceTask"("applianceId");

-- CreateIndex
CREATE UNIQUE INDEX "AlfredConfirmation_token_key" ON "AlfredConfirmation"("token");

-- CreateIndex
CREATE INDEX "AlfredConfirmation_expiresAt_idx" ON "AlfredConfirmation"("expiresAt");

-- CreateIndex
CREATE INDEX "MaintenanceEntry_taskId_idx" ON "MaintenanceEntry"("taskId");

-- AddForeignKey
ALTER TABLE "MaintenanceEntry" ADD CONSTRAINT "MaintenanceEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MaintenanceTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_applianceId_fkey" FOREIGN KEY ("applianceId") REFERENCES "Appliance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
