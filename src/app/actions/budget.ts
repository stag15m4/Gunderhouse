"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BudgetKind, Cadence, HomeRole } from "@prisma/client";
import { requireHome, requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  enumValue,
  optionalDate,
  optionalInt,
  optionalMoneyCents,
  optionalStr,
  requireText,
  str,
} from "@/lib/forms";
import { isRedirectError, withError } from "@/lib/action-utils";

/**
 * The budget is household-wide: groceries and income belong to nobody's house
 * in particular. Anyone signed in can see and change it — the per-home roles
 * govern homes, not the family's money. Categories bound to a house are the one
 * exception, and they're checked against that home below.
 */
async function requireBudgetAccess() {
  return requireUser();
}

function moneyRequired(form: FormData, key: string, label: string): number {
  const cents = optionalMoneyCents(form, key);
  if (cents === null) throw new Error(`${label} is required.`);
  if (cents < 0) throw new Error(`${label} can't be negative.`);
  return cents;
}

/** Categories may be bound to a house; binding one requires access to it. */
async function checkHomeBinding(homeId: string | null) {
  if (homeId) await requireHome(homeId, HomeRole.MEMBER);
}

function backTo(form: FormData, fallback = "/budget"): string {
  const raw = str(form, "returnTo");
  return /^\/[A-Za-z0-9/_-]*$/.test(raw) ? raw : fallback;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function createCategory(form: FormData) {
  const back = backTo(form, "/budget/setup");
  try {
    await requireBudgetAccess();
    const homeId = optionalStr(form, "homeId");
    await checkHomeBinding(homeId);

    await prisma.budgetCategory.create({
      data: {
        name: requireText(form, "name", "Category name"),
        kind: enumValue(form, "kind", BudgetKind, BudgetKind.EXPENSE),
        monthlyTargetCents: optionalMoneyCents(form, "monthlyTarget"),
        homeId,
        sortOrder: optionalInt(form, "sortOrder") ?? 0,
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/budget");
  revalidatePath(back);
  redirect(back);
}

export async function updateCategory(categoryId: string, form: FormData) {
  const back = backTo(form, "/budget/setup");
  try {
    await requireBudgetAccess();
    const homeId = optionalStr(form, "homeId");
    await checkHomeBinding(homeId);

    await prisma.budgetCategory.update({
      where: { id: categoryId },
      data: {
        name: requireText(form, "name", "Category name"),
        kind: enumValue(form, "kind", BudgetKind, BudgetKind.EXPENSE),
        monthlyTargetCents: optionalMoneyCents(form, "monthlyTarget"),
        homeId,
        sortOrder: optionalInt(form, "sortOrder") ?? 0,
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/budget");
  revalidatePath(back);
  redirect(back);
}

/**
 * Archiving rather than deleting, so a category that carried six months of
 * groceries doesn't take that history with it. Deletion is available for
 * categories nothing has been logged against.
 */
export async function archiveCategory(categoryId: string, form: FormData) {
  const back = backTo(form, "/budget/setup");
  try {
    await requireBudgetAccess();
    const [entries, recurring] = await Promise.all([
      prisma.budgetEntry.count({ where: { categoryId } }),
      prisma.recurringItem.count({ where: { categoryId } }),
    ]);

    if (entries === 0 && recurring === 0) {
      await prisma.budgetCategory.delete({ where: { id: categoryId } });
    } else {
      await prisma.budgetCategory.update({
        where: { id: categoryId },
        data: { archived: true },
      });
    }
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/budget");
  revalidatePath(back);
  redirect(back);
}

export async function restoreCategory(categoryId: string, form: FormData) {
  const back = backTo(form, "/budget/setup");
  try {
    await requireBudgetAccess();
    await prisma.budgetCategory.update({
      where: { id: categoryId },
      data: { archived: false },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/budget");
  revalidatePath(back);
  redirect(back);
}

// ---------------------------------------------------------------------------
// Recurring items — the Disney+ subscription, the insurance premium
// ---------------------------------------------------------------------------

export async function createRecurring(form: FormData) {
  const back = backTo(form, "/budget/setup");
  try {
    await requireBudgetAccess();
    await prisma.recurringItem.create({
      data: {
        categoryId: requireText(form, "categoryId", "Category"),
        label: requireText(form, "label", "Name"),
        amountCents: moneyRequired(form, "amount", "Amount"),
        cadence: enumValue(form, "cadence", Cadence, Cadence.MONTHLY),
        startsOn: optionalDate(form, "startsOn"),
        endsOn: optionalDate(form, "endsOn"),
        notes: optionalStr(form, "notes"),
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/budget");
  revalidatePath(back);
  redirect(back);
}

export async function updateRecurring(itemId: string, form: FormData) {
  const back = backTo(form, "/budget/setup");
  try {
    await requireBudgetAccess();
    await prisma.recurringItem.update({
      where: { id: itemId },
      data: {
        categoryId: requireText(form, "categoryId", "Category"),
        label: requireText(form, "label", "Name"),
        amountCents: moneyRequired(form, "amount", "Amount"),
        cadence: enumValue(form, "cadence", Cadence, Cadence.MONTHLY),
        startsOn: optionalDate(form, "startsOn"),
        endsOn: optionalDate(form, "endsOn"),
        notes: optionalStr(form, "notes"),
        active: str(form, "active") === "on",
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/budget");
  revalidatePath(back);
  redirect(back);
}

export async function deleteRecurring(itemId: string, form: FormData) {
  const back = backTo(form, "/budget/setup");
  try {
    await requireBudgetAccess();
    await prisma.recurringItem.delete({ where: { id: itemId } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/budget");
  revalidatePath(back);
  redirect(back);
}

// ---------------------------------------------------------------------------
// Entries — money that actually moved
// ---------------------------------------------------------------------------

/**
 * One entry a month per category is enough: "groceries, $1,240, March". Finer
 * entry works the same way and is never required, which is the difference
 * between a budget that gets kept up and one that gets abandoned in week three.
 */
export async function createEntry(form: FormData) {
  const back = backTo(form);
  try {
    const user = await requireBudgetAccess();
    const occurredOn =
      optionalDate(form, "occurredOn") ??
      new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

    await prisma.budgetEntry.create({
      data: {
        categoryId: requireText(form, "categoryId", "Category"),
        occurredOn,
        amountCents: moneyRequired(form, "amount", "Amount"),
        description: optionalStr(form, "description"),
        createdById: user.id,
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/budget");
  revalidatePath(back);
  redirect(back);
}

export async function updateEntry(entryId: string, form: FormData) {
  const back = backTo(form);
  try {
    await requireBudgetAccess();
    await prisma.budgetEntry.update({
      where: { id: entryId },
      data: {
        categoryId: requireText(form, "categoryId", "Category"),
        occurredOn:
          optionalDate(form, "occurredOn") ??
          new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"),
        amountCents: moneyRequired(form, "amount", "Amount"),
        description: optionalStr(form, "description"),
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/budget");
  revalidatePath(back);
  redirect(back);
}

export async function deleteEntry(entryId: string, form: FormData) {
  const back = backTo(form);
  try {
    await requireBudgetAccess();
    await prisma.budgetEntry.delete({ where: { id: entryId } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/budget");
  revalidatePath(back);
  redirect(back);
}

// ---------------------------------------------------------------------------
// A house's own monthly budget
// ---------------------------------------------------------------------------

export async function setHomeBudget(homeId: string, form: FormData) {
  const back = backTo(form, `/homes/${homeId}`);
  try {
    await requireHome(homeId, HomeRole.ADMIN);
    const cents = optionalMoneyCents(form, "monthlyBudget");
    if (cents !== null && cents < 0) {
      throw new Error("A monthly budget can't be negative.");
    }
    await prisma.home.update({
      where: { id: homeId },
      data: { monthlyBudgetCents: cents },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/budget");
  revalidatePath(back);
  redirect(back);
}
