-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNED', 'DONE');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "estimatedCostCents" INTEGER NOT NULL,
    "targetOn" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "completedOn" TIMESTAMP(3),
    "actualCostCents" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_homeId_status_targetOn_idx" ON "Project"("homeId", "status", "targetOn");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
