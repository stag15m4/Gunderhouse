-- CreateEnum
CREATE TYPE "ValuationSource" AS ENUM ('APPRAISAL', 'BROKER_OPINION', 'TAX_ASSESSMENT', 'ONLINE_ESTIMATE', 'PURCHASE_PRICE', 'OWNER_ESTIMATE');

-- CreateEnum
CREATE TYPE "LienType" AS ENUM ('FIRST_MORTGAGE', 'SECOND_MORTGAGE', 'HELOC', 'HOME_EQUITY_LOAN', 'TAX_LIEN', 'MECHANICS_LIEN', 'JUDGMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "LienSource" AS ENUM ('MANUAL', 'LEGAL');

-- AlterTable
ALTER TABLE "Home" ADD COLUMN     "managementFeeBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxCombinedLtvBps" INTEGER NOT NULL DEFAULT 8000,
ADD COLUMN     "monthlyRentCents" INTEGER,
ADD COLUMN     "vacancyRateBps" INTEGER NOT NULL DEFAULT 500;

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "valuedOn" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "source" "ValuationSource" NOT NULL DEFAULT 'OWNER_ESTIMATE',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lien" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "type" "LienType" NOT NULL DEFAULT 'FIRST_MORTGAGE',
    "lender" TEXT NOT NULL,
    "position" INTEGER,
    "originalAmountCents" INTEGER,
    "currentBalanceCents" INTEGER NOT NULL,
    "balanceAsOf" TIMESTAMP(3),
    "creditLimitCents" INTEGER,
    "interestRateBps" INTEGER,
    "monthlyPaymentCents" INTEGER,
    "openedOn" TIMESTAMP(3),
    "maturesOn" TIMESTAMP(3),
    "closedOn" TIMESTAMP(3),
    "notes" TEXT,
    "source" "LienSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "externalUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lien_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Valuation_homeId_valuedOn_idx" ON "Valuation"("homeId", "valuedOn");

-- CreateIndex
CREATE INDEX "Lien_homeId_closedOn_idx" ON "Lien"("homeId", "closedOn");

-- CreateIndex
CREATE UNIQUE INDEX "Lien_source_externalId_key" ON "Lien"("source", "externalId");

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lien" ADD CONSTRAINT "Lien_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "Home"("id") ON DELETE CASCADE ON UPDATE CASCADE;
