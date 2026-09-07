"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  HomeRole,
  LienSource,
  LienType,
  ValuationSource,
} from "@prisma/client";
import { requireHome } from "@/lib/access";
import { budgetAccessFor } from "@/lib/budget-access";
import { prisma } from "@/lib/prisma";
import {
  enumValue,
  optionalDate,
  optionalInt,
  optionalMoneyCents,
  optionalStr,
  requireText,
  requiredDate,
  str,
} from "@/lib/forms";
import { isRedirectError, withError } from "@/lib/action-utils";

/**
 * What a house is worth and what's owed on it is household-admin territory —
 * the same bar as budget categories, and for the same reason. Looking after a
 * property, even as its ADMIN, is no reason to be recording mortgages against
 * it. Both checks run: household standing decides, home access confirms the
 * property is theirs to touch at all.
 *
 * Reading is governed separately, on the page, by budget view access.
 */
async function requirePropertyAdmin(homeId: string) {
  const context = await requireHome(homeId, HomeRole.ADMIN);
  if (!budgetAccessFor(context.user).canAdminister) {
    throw new Error(
      "Only household admins can change what a property is worth or owes.",
    );
  }
  return context;
}

function back(homeId: string) {
  return `/homes/${homeId}/finance`;
}

function moneyRequired(form: FormData, key: string, label: string): number {
  const cents = optionalMoneyCents(form, key);
  if (cents === null) throw new Error(`${label} is required.`);
  if (cents < 0) throw new Error(`${label} can't be negative.`);
  return cents;
}

/** Percentages are entered as "5" or "5.5" and stored as basis points. */
function percentToBps(form: FormData, key: string, fallback: number): number {
  const raw = str(form, key).replace(/[%\s]/g, "");
  if (raw === "") return fallback;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error("Percentages must be between 0 and 100.");
  }
  return Math.round(parsed * 100);
}

// ---------------------------------------------------------------------------
// Valuations
// ---------------------------------------------------------------------------

export async function addValuation(homeId: string, form: FormData) {
  try {
    const { user } = await requirePropertyAdmin(homeId);
    await prisma.valuation.create({
      data: {
        homeId,
        valuedOn: requiredDate(form, "valuedOn"),
        amountCents: moneyRequired(form, "amount", "Value"),
        source: enumValue(
          form,
          "source",
          ValuationSource,
          ValuationSource.OWNER_ESTIMATE,
        ),
        notes: optionalStr(form, "notes"),
        createdById: user.id,
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back(homeId), error));
  }

  revalidatePath(back(homeId));
  redirect(back(homeId));
}

export async function deleteValuation(
  homeId: string,
  valuationId: string,
) {
  try {
    await requirePropertyAdmin(homeId);
    await prisma.valuation.delete({
      where: { id: valuationId, homeId },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back(homeId), error));
  }

  revalidatePath(back(homeId));
  redirect(back(homeId));
}

// ---------------------------------------------------------------------------
// Liens
// ---------------------------------------------------------------------------

function lienFieldsFrom(form: FormData) {
  const creditLimitCents = optionalMoneyCents(form, "creditLimit");
  const currentBalanceCents = moneyRequired(form, "currentBalance", "Balance");

  if (creditLimitCents !== null && creditLimitCents < currentBalanceCents) {
    throw new Error("A credit limit can't be less than the balance drawn.");
  }

  return {
    type: enumValue(form, "type", LienType, LienType.FIRST_MORTGAGE),
    lender: requireText(form, "lender", "Lender"),
    position: optionalInt(form, "position"),
    originalAmountCents: optionalMoneyCents(form, "originalAmount"),
    currentBalanceCents,
    balanceAsOf: optionalDate(form, "balanceAsOf"),
    creditLimitCents,
    interestRateBps: (() => {
      const raw = str(form, "interestRate");
      return raw === "" ? null : percentToBps(form, "interestRate", 0);
    })(),
    monthlyPaymentCents: optionalMoneyCents(form, "monthlyPayment"),
    openedOn: optionalDate(form, "openedOn"),
    maturesOn: optionalDate(form, "maturesOn"),
    notes: optionalStr(form, "notes"),
  };
}

export async function createLien(homeId: string, form: FormData) {
  try {
    await requirePropertyAdmin(homeId);
    await prisma.lien.create({
      data: { homeId, source: LienSource.MANUAL, ...lienFieldsFrom(form) },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back(homeId), error));
  }

  revalidatePath(back(homeId));
  redirect(back(homeId));
}

/**
 * Liens synced from the Legal app are read-only here. Legal is the system of
 * record for anything with a filing behind it, and letting the same row be
 * edited in two places is how the two quietly stop agreeing.
 */
async function lienForWrite(homeId: string, lienId: string) {
  await requirePropertyAdmin(homeId);
  const lien = await prisma.lien.findUnique({ where: { id: lienId } });
  if (!lien || lien.homeId !== homeId) throw new Error("Lien not found.");
  if (lien.source === LienSource.LEGAL) {
    throw new Error(
      "This one is synced from Legal — change it there and it'll update here.",
    );
  }
  return lien;
}

export async function updateLien(
  homeId: string,
  lienId: string,
  form: FormData,
) {
  try {
    await lienForWrite(homeId, lienId);
    await prisma.lien.update({
      where: { id: lienId },
      data: lienFieldsFrom(form),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back(homeId), error));
  }

  revalidatePath(back(homeId));
  redirect(back(homeId));
}

/** Paid off or released. Closed liens stop counting against equity. */
export async function closeLien(homeId: string, lienId: string, form: FormData) {
  try {
    await lienForWrite(homeId, lienId);
    await prisma.lien.update({
      where: { id: lienId },
      data: {
        closedOn:
          optionalDate(form, "closedOn") ??
          new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"),
        currentBalanceCents: 0,
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back(homeId), error));
  }

  revalidatePath(back(homeId));
  redirect(back(homeId));
}

export async function reopenLien(homeId: string, lienId: string) {
  try {
    await lienForWrite(homeId, lienId);
    await prisma.lien.update({
      where: { id: lienId },
      data: { closedOn: null },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back(homeId), error));
  }

  revalidatePath(back(homeId));
  redirect(back(homeId));
}

export async function deleteLien(homeId: string, lienId: string) {
  try {
    await lienForWrite(homeId, lienId);
    await prisma.lien.delete({ where: { id: lienId } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back(homeId), error));
  }

  revalidatePath(back(homeId));
  redirect(back(homeId));
}

// ---------------------------------------------------------------------------
// Rental terms and lending assumptions
// ---------------------------------------------------------------------------

export async function setRentalTerms(homeId: string, form: FormData) {
  try {
    await requirePropertyAdmin(homeId);
    const rent = optionalMoneyCents(form, "monthlyRent");
    if (rent !== null && rent < 0) {
      throw new Error("Rent can't be negative.");
    }

    const vacancy = percentToBps(form, "vacancyRate", 500);
    const management = percentToBps(form, "managementFee", 0);
    if (vacancy + management >= 10000) {
      throw new Error(
        "Vacancy and management can't add up to 100% — there'd be no rent left.",
      );
    }

    await prisma.home.update({
      where: { id: homeId },
      data: {
        monthlyRentCents: rent,
        vacancyRateBps: vacancy,
        managementFeeBps: management,
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back(homeId), error));
  }

  revalidatePath(back(homeId));
  redirect(back(homeId));
}

export async function setLendingAssumption(homeId: string, form: FormData) {
  try {
    await requirePropertyAdmin(homeId);
    await prisma.home.update({
      where: { id: homeId },
      data: { maxCombinedLtvBps: percentToBps(form, "maxCombinedLtv", 8000) },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back(homeId), error));
  }

  revalidatePath(back(homeId));
  redirect(back(homeId));
}
