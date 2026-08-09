import { redirect } from "next/navigation";
import { BudgetRole, BudgetVisibility, SystemRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { requireUser, type SessionUser } from "@/lib/access";

/**
 * Budget access
 * -------------
 * Two independent questions, because they are genuinely different:
 *
 *   1. May this person touch the budget at all, and how much?
 *      `User.budgetRole` — NONE, VIEWER, EDITOR. Household admins
 *      (systemRole OWNER) bypass it and always have full access, the same way
 *      they hold implicit ADMIN on every home.
 *
 *   2. May this person see *this line*?
 *      `BudgetCategory.visibility` — EVERYONE or ADMINS. Income and the bills
 *      normally sit at ADMINS, so someone can be given the grocery budget
 *      without being shown what the household earns.
 *
 * Access to a house grants nothing here. Logging maintenance on the house you
 * live in has no bearing on whether you should see the mortgage.
 */

export type BudgetAccess = {
  /** Sees the budget at all. */
  canView: boolean;
  /** Logs and edits spending. */
  canEdit: boolean;
  /** Manages categories, recurring charges, and who can see what. */
  canAdminister: boolean;
  /** Sees categories marked admins-only. */
  canSeeRestricted: boolean;
};

export function budgetAccessFor(user: SessionUser): BudgetAccess {
  if (user.systemRole === SystemRole.OWNER) {
    return {
      canView: true,
      canEdit: true,
      canAdminister: true,
      canSeeRestricted: true,
    };
  }

  const role = user.budgetRole;
  return {
    canView: role !== BudgetRole.NONE,
    canEdit: role === BudgetRole.EDITOR,
    // Only household admins shape the budget or decide who sees what. An
    // EDITOR logs spending; they don't get to unhide the income line.
    canAdminister: false,
    canSeeRestricted: false,
  };
}

/**
 * The `where` clause restricting categories to what this person may see.
 * Applied at the query, not after — a category they can't see should never
 * reach the page, where it could leak through a total.
 */
export function visibleCategoryWhere(
  user: SessionUser,
): Prisma.BudgetCategoryWhereInput {
  return budgetAccessFor(user).canSeeRestricted
    ? {}
    : { visibility: BudgetVisibility.EVERYONE };
}

export function canSeeCategory(
  user: SessionUser,
  category: { visibility: BudgetVisibility },
): boolean {
  return (
    category.visibility === BudgetVisibility.EVERYONE ||
    budgetAccessFor(user).canSeeRestricted
  );
}

/** Signed in, with at least read access to the budget. */
export async function requireBudgetView(): Promise<{
  user: SessionUser;
  access: BudgetAccess;
}> {
  const user = await requireUser();
  const access = budgetAccessFor(user);
  if (!access.canView) redirect("/homes");
  return { user, access };
}

/** Signed in, and allowed to log spending. */
export async function requireBudgetEdit(): Promise<SessionUser> {
  const user = await requireUser();
  if (!budgetAccessFor(user).canEdit) {
    throw new BudgetAccessError("You don't have access to change the budget.");
  }
  return user;
}

/** Signed in, and allowed to shape the budget itself. */
export async function requireBudgetAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!budgetAccessFor(user).canAdminister) {
    throw new BudgetAccessError(
      "Only household admins can change budget categories.",
    );
  }
  return user;
}

export class BudgetAccessError extends Error {}

/** Page-level guard: household admins only, redirecting rather than throwing. */
export async function requireBudgetAdminPage(): Promise<SessionUser> {
  const user = await requireUser();
  if (!budgetAccessFor(user).canAdminister) redirect("/budget");
  return user;
}

export const BUDGET_ROLE_LABELS: Record<BudgetRole, string> = {
  NONE: "No access",
  VIEWER: "Can view",
  EDITOR: "Can log spending",
};

export const BUDGET_VISIBILITY_LABELS: Record<BudgetVisibility, string> = {
  EVERYONE: "Everyone with budget access",
  ADMINS: "Household admins only",
};
