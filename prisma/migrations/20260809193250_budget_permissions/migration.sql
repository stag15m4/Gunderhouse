-- CreateEnum
CREATE TYPE "BudgetRole" AS ENUM ('NONE', 'VIEWER', 'EDITOR');

-- CreateEnum
CREATE TYPE "BudgetVisibility" AS ENUM ('EVERYONE', 'ADMINS');

-- AlterTable
ALTER TABLE "BudgetCategory" ADD COLUMN     "assistantAccess" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "visibility" "BudgetVisibility" NOT NULL DEFAULT 'ADMINS';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "budgetRole" "BudgetRole" NOT NULL DEFAULT 'NONE';
