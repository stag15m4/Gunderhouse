import type { Home, Lien } from "@prisma/client";
import { monthlyDebtServiceCents } from "./equity";

/**
 * Setting rent against what the property actually costs.
 *
 * The costs split in two, and the split is the whole trick:
 *
 *   Fixed costs don't move with the rent — debt service, insurance, taxes,
 *   HOA, and the replacement reserve.
 *
 *   Proportional costs are a share of the rent itself — vacancy (months you
 *   collect nothing) and a manager's cut.
 *
 * So break-even isn't the sum of the costs. Charging exactly your fixed costs
 * loses money, because vacancy and management take their share off the top.
 * Solve instead:
 *
 *     rent x (1 - vacancy - management) = fixed
 *     rent = fixed / (1 - vacancy - management)
 *
 * At 5% vacancy and a 10% manager, $2,000 of fixed costs needs $2,353 of rent,
 * not $2,000. That $353 is the gap this exists to close.
 *
 * This is a planning tool, not an accounting of rent received. Nothing here
 * tracks tenants, leases, or payments, and it shouldn't grow to.
 */

export type RentPicture = {
  /** Costs that don't scale with rent, per month. */
  debtServiceCents: number;
  carryingCostCents: number;
  reserveCents: number;
  maintenanceRunRateCents: number;
  fixedCostCents: number;

  /** The share of rent lost before it reaches you, in basis points. */
  proportionalBps: number;
  vacancyRateBps: number;
  managementFeeBps: number;

  /** Rent that exactly covers the fixed costs. Null if the rates make it impossible. */
  breakEvenRentCents: number | null;

  /** What's actually being charged, if set. */
  rentCents: number | null;
  /** Rent left after vacancy and management. */
  effectiveRentCents: number | null;
  /** Effective rent less fixed costs. Negative means it's losing money. */
  monthlyCashFlowCents: number | null;
  /** Cash flow over rent, in basis points. Null without a rent. */
  marginBps: number | null;
};

export function buildRent({
  home,
  liens,
  carryingCostCents,
  reserveCents,
  maintenanceRunRateCents,
}: {
  home: Pick<Home, "monthlyRentCents" | "vacancyRateBps" | "managementFeeBps">;
  liens: Lien[];
  /** Insurance, taxes, HOA — the budget categories bound to this house. */
  carryingCostCents: number;
  /** Replacement accrual for the appliances and systems here. */
  reserveCents: number;
  /** Trailing average of what upkeep has actually cost, per month. */
  maintenanceRunRateCents: number;
}): RentPicture {
  const debtServiceCents = monthlyDebtServiceCents(liens);
  const fixedCostCents =
    debtServiceCents +
    carryingCostCents +
    reserveCents +
    maintenanceRunRateCents;

  const proportionalBps = home.vacancyRateBps + home.managementFeeBps;
  const keepShare = (10000 - proportionalBps) / 10000;

  // Guard the degenerate case: at 100% or more going to vacancy and fees, no
  // rent covers anything and the division would blow up or go negative.
  const breakEvenRentCents =
    keepShare > 0 ? Math.round(fixedCostCents / keepShare) : null;

  const rentCents = home.monthlyRentCents;
  const effectiveRentCents =
    rentCents === null ? null : Math.round(rentCents * keepShare);
  const monthlyCashFlowCents =
    effectiveRentCents === null ? null : effectiveRentCents - fixedCostCents;

  return {
    debtServiceCents,
    carryingCostCents,
    reserveCents,
    maintenanceRunRateCents,
    fixedCostCents,
    proportionalBps,
    vacancyRateBps: home.vacancyRateBps,
    managementFeeBps: home.managementFeeBps,
    breakEvenRentCents,
    rentCents,
    effectiveRentCents,
    monthlyCashFlowCents,
    marginBps:
      rentCents && rentCents > 0 && monthlyCashFlowCents !== null
        ? Math.round((monthlyCashFlowCents / rentCents) * 10000)
        : null,
  };
}

/**
 * Rent needed to clear a given monthly profit — the other question people ask
 * once break-even is known.
 */
export function rentForCashFlow(
  picture: RentPicture,
  targetCashFlowCents: number,
): number | null {
  const keepShare = (10000 - picture.proportionalBps) / 10000;
  if (keepShare <= 0) return null;
  return Math.round((picture.fixedCostCents + targetCashFlowCents) / keepShare);
}

/**
 * Average monthly maintenance over a trailing window. Falls back to the months
 * actually covered, so a house with three months of history isn't reported as
 * spending a twelfth of it.
 */
export function maintenanceRunRate(
  entries: Array<{ performedOn: Date; costCents: number | null }>,
  months = 12,
  now = new Date(),
): number {
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1),
  );
  const recent = entries.filter((e) => e.performedOn >= cutoff);
  if (recent.length === 0) return 0;

  const oldest = recent.reduce(
    (min, e) => (e.performedOn < min ? e.performedOn : min),
    recent[0].performedOn,
  );
  const spanMonths = Math.max(
    1,
    (now.getUTCFullYear() - oldest.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - oldest.getUTCMonth()) +
      1,
  );

  const total = recent.reduce((sum, e) => sum + (e.costCents ?? 0), 0);
  return Math.round(total / Math.min(spanMonths, months));
}
