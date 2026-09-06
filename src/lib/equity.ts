import type { Home, Lien, Valuation } from "@prisma/client";
import { LienType } from "@prisma/client";

/**
 * What a property is worth, what's owed on it, and what that leaves.
 *
 * "Available equity" is deliberately reported as two different numbers,
 * because they aren't the same kind of money:
 *
 *   - Undrawn credit is spendable today. A HELOC with a $100k limit and $20k
 *     drawn is $80k you can move this afternoon, subject to nothing.
 *   - Borrowing headroom is what a lender would probably still lend against
 *     the house, given a combined loan-to-value ceiling. Getting at it means
 *     originating a loan: an application, an appraisal, weeks.
 *
 * Collapsing the two into one "available equity" figure is how people end up
 * counting money they can't actually reach, so this keeps them apart.
 */

export type EquityPicture = {
  /** The valuation the whole calculation stands on, or null if none exists. */
  basis: Valuation | null;
  valueCents: number;
  /** Balance of every open lien. */
  totalOwedCents: number;
  /** Value less what's owed. What you'd clear on a sale, before costs. */
  grossEquityCents: number;
  /** Owed over value. Null without a valuation. */
  ltvBps: number | null;
  /** Spendable today: the undrawn part of open credit lines. */
  undrawnCreditCents: number;
  /**
   * What could still be borrowed against the house before hitting the assumed
   * combined LTV ceiling. Never negative — being over the ceiling means no
   * headroom, not negative headroom.
   */
  borrowingHeadroomCents: number;
  /** The ceiling used, in basis points. */
  maxCombinedLtvBps: number;
  /** True when nothing has been valued yet, so every figure below is unusable. */
  unvalued: boolean;
  liens: Lien[];
};

const CREDIT_LINE_TYPES = new Set<LienType>([LienType.HELOC]);

export function isOpen(lien: Pick<Lien, "closedOn">): boolean {
  return lien.closedOn === null;
}

export function buildEquity({
  home,
  valuations,
  liens,
}: {
  home: Pick<Home, "maxCombinedLtvBps">;
  valuations: Valuation[];
  liens: Lien[];
}): EquityPicture {
  // Most recent valuation wins. Sources disagree and go stale; the fix is to
  // show which one is being used, not to average them into a number that
  // matches no document anyone holds.
  const basis =
    [...valuations].sort(
      (a, b) => b.valuedOn.getTime() - a.valuedOn.getTime(),
    )[0] ?? null;

  const valueCents = basis?.amountCents ?? 0;
  const open = liens.filter(isOpen);
  const totalOwedCents = open.reduce((sum, l) => sum + l.currentBalanceCents, 0);

  const undrawnCreditCents = open
    .filter((l) => CREDIT_LINE_TYPES.has(l.type) && l.creditLimitCents !== null)
    .reduce(
      (sum, l) =>
        sum + Math.max(0, (l.creditLimitCents ?? 0) - l.currentBalanceCents),
      0,
    );

  const ceiling = Math.round((valueCents * home.maxCombinedLtvBps) / 10000);
  // Balances already drawn on a line count against the ceiling; the undrawn
  // part does not, or it would be counted twice — once as undrawn credit and
  // again as headroom.
  const borrowingHeadroomCents = basis
    ? Math.max(0, ceiling - totalOwedCents)
    : 0;

  return {
    basis,
    valueCents,
    totalOwedCents,
    grossEquityCents: valueCents - totalOwedCents,
    ltvBps:
      basis && valueCents > 0
        ? Math.round((totalOwedCents / valueCents) * 10000)
        : null,
    undrawnCreditCents,
    borrowingHeadroomCents,
    maxCombinedLtvBps: home.maxCombinedLtvBps,
    unvalued: basis === null,
    liens: [...liens].sort(
      (a, b) =>
        (a.position ?? 99) - (b.position ?? 99) ||
        b.currentBalanceCents - a.currentBalanceCents,
    ),
  };
}

/** Monthly debt service across open liens that have a payment recorded. */
export function monthlyDebtServiceCents(liens: Lien[]): number {
  return liens
    .filter(isOpen)
    .reduce((sum, l) => sum + (l.monthlyPaymentCents ?? 0), 0);
}

/** How stale the valuation is, in whole months. Null when there isn't one. */
export function valuationAgeMonths(
  basis: Valuation | null,
  now = new Date(),
): number | null {
  if (!basis) return null;
  const months =
    (now.getUTCFullYear() - basis.valuedOn.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - basis.valuedOn.getUTCMonth());
  return Math.max(0, months);
}

export const VALUATION_SOURCE_LABELS = {
  APPRAISAL: "Appraisal",
  BROKER_OPINION: "Broker opinion",
  TAX_ASSESSMENT: "Tax assessment",
  ONLINE_ESTIMATE: "Online estimate",
  PURCHASE_PRICE: "Purchase price",
  OWNER_ESTIMATE: "Own estimate",
} as const;

export const LIEN_TYPE_LABELS = {
  FIRST_MORTGAGE: "First mortgage",
  SECOND_MORTGAGE: "Second mortgage",
  HELOC: "HELOC",
  HOME_EQUITY_LOAN: "Home equity loan",
  TAX_LIEN: "Tax lien",
  MECHANICS_LIEN: "Mechanic's lien",
  JUDGMENT: "Judgment",
  OTHER: "Other",
} as const;

export const formatBps = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`;
