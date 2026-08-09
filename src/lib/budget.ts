import type {
  BudgetCategory,
  BudgetEntry,
  Cadence,
  MaintenanceEntry,
  Project,
  RecurringItem,
} from "@prisma/client";
import { BudgetKind, ProjectStatus } from "@prisma/client";
import { lifespanFor } from "./lifespans";
import type { ForecastInput } from "./forecast";

/**
 * A calendar month, identified the way a URL wants it. Everything in the budget
 * is bucketed by month; nothing here needs finer resolution than that.
 */
export type Month = { year: number; month: number }; // month is 1-12

export function monthKey({ year, month }: Month): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonth(key: string | undefined, now = new Date()): Month {
  const match = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export function monthStart({ year, month }: Month): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Exclusive — the first instant of the following month. */
export function monthEnd({ year, month }: Month): Date {
  return new Date(Date.UTC(year, month, 1));
}

export function shiftMonth({ year, month }: Month, by: number): Month {
  const zero = year * 12 + (month - 1) + by;
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
}

export function monthLabel({ year, month }: Month): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * What a recurring charge works out to per month.
 *
 * Everything is smoothed to a monthly equivalent rather than landing in the
 * month it happens to be billed. A budget answering "what do we need each
 * month?" is more useful than one that shows a $2,100 insurance spike in June
 * and calls the other eleven months a surplus. The trade is that a single
 * month's figure won't match a single month's bank statement, which is the
 * right trade for planning.
 */
export function monthlyEquivalent(amountCents: number, cadence: Cadence): number {
  switch (cadence) {
    case "WEEKLY":
      return Math.round((amountCents * 52) / 12);
    case "QUARTERLY":
      return Math.round(amountCents / 3);
    case "ANNUAL":
      return Math.round(amountCents / 12);
    case "MONTHLY":
    default:
      return amountCents;
  }
}

/** Whether a recurring item is live during the given month. */
export function activeInMonth(item: RecurringItem, month: Month): boolean {
  if (!item.active) return false;
  const start = monthStart(month);
  const end = monthEnd(month);
  if (item.startsOn && item.startsOn >= end) return false;
  if (item.endsOn && item.endsOn < start) return false;
  return true;
}

export type CategoryLine = {
  category: BudgetCategory;
  /** Recurring charges live this month, already smoothed to monthly. */
  committedCents: number;
  /** Variable amounts actually logged this month. */
  loggedCents: number;
  /** What the month really came to. */
  actualCents: number;
  /** What was planned: the target if one is set, otherwise the committed total. */
  plannedCents: number;
  /**
   * Over (positive) or under (negative) plan. Meaningless without a target, so
   * null when the category has none.
   */
  varianceCents: number | null;
  items: RecurringItem[];
};

export function buildCategoryLine(
  category: BudgetCategory & { recurring: RecurringItem[] },
  entries: BudgetEntry[],
  month: Month,
): CategoryLine {
  const items = category.recurring.filter((item) => activeInMonth(item, month));
  const committedCents = items.reduce(
    (sum, item) => sum + monthlyEquivalent(item.amountCents, item.cadence),
    0,
  );
  const loggedCents = entries.reduce((sum, e) => sum + e.amountCents, 0);
  const actualCents = committedCents + loggedCents;
  const plannedCents = category.monthlyTargetCents ?? committedCents;

  return {
    category,
    committedCents,
    loggedCents,
    actualCents,
    plannedCents,
    varianceCents:
      category.monthlyTargetCents === null
        ? null
        : actualCents - category.monthlyTargetCents,
    items,
  };
}

/**
 * What a house costs in a given month, read from records that already exist.
 * Maintenance and projects are never re-entered into the budget — they carry
 * costs where they are, and this reads them there.
 */
export type HomeMonth = {
  homeId: string;
  homeName: string;
  maintenanceCents: number;
  projectCents: number;
  /** Budget categories bound to this house — its mortgage, its insurance. */
  categoryCents: number;
  totalCents: number;
  budgetCents: number | null;
  varianceCents: number | null;
  /**
   * What this house should be setting aside monthly for appliance and system
   * replacement, from the forecast's own numbers. Not spending — saving.
   */
  reserveCents: number;
};

export function buildHomeMonth({
  home,
  maintenance,
  projects,
  categoryLines,
  appliances,
}: {
  home: { id: string; name: string; monthlyBudgetCents: number | null };
  maintenance: MaintenanceEntry[];
  projects: Project[];
  categoryLines: CategoryLine[];
  appliances: ForecastInput[];
}): HomeMonth {
  const maintenanceCents = maintenance.reduce(
    (sum, e) => sum + (e.costCents ?? 0),
    0,
  );
  const projectCents = projects.reduce(
    (sum, p) => sum + (p.actualCostCents ?? 0),
    0,
  );
  const categoryCents = categoryLines
    .filter((line) => line.category.homeId === home.id)
    .reduce(
      (sum, line) =>
        sum +
        (line.category.kind === BudgetKind.EXPENSE
          ? line.actualCents
          : -line.actualCents),
      0,
    );

  const totalCents = maintenanceCents + projectCents + categoryCents;

  return {
    homeId: home.id,
    homeName: home.name,
    maintenanceCents,
    projectCents,
    categoryCents,
    totalCents,
    budgetCents: home.monthlyBudgetCents,
    varianceCents:
      home.monthlyBudgetCents === null
        ? null
        : totalCents - home.monthlyBudgetCents,
    reserveCents: monthlyReserveCents(appliances),
  };
}

/**
 * The monthly set-aside that keeps a house even on replacement costs.
 *
 * Each appliance wears out over a known-ish span and costs a known-ish amount
 * to replace, so it accrues cost every month whether or not anything breaks.
 * Spread each unit's replacement cost across the midpoint of its expected life
 * and add them up. This is the number a general-purpose budgeting app cannot
 * produce and this one can, because it already knows what's in the house.
 *
 * A planning figure, not a sinking-fund schedule — same spirit as the forecast.
 */
export function monthlyReserveCents(
  appliances: ForecastInput[],
): number {
  const perYearDollars = appliances.reduce((sum, appliance) => {
    const table = lifespanFor(appliance.category);
    if (!table.replacementCost) return sum;
    const low = appliance.expectedLifeLowYears ?? table.low;
    const high = appliance.expectedLifeHighYears ?? table.high;
    const life = (low + high) / 2;
    return life > 0 ? sum + table.replacementCost / life : sum;
  }, 0);

  return Math.round((perYearDollars * 100) / 12);
}

export type BudgetSummary = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  plannedIncomeCents: number;
  plannedExpenseCents: number;
  plannedNetCents: number;
};

/**
 * Roll the whole month up. House costs are added to expenses here rather than
 * being carried as categories, so nothing is counted twice: a category bound to
 * a home is already inside `homeMonths`, so only unbound categories are summed.
 */
export function summarise(
  lines: CategoryLine[],
  homeMonths: HomeMonth[],
): BudgetSummary {
  const household = lines.filter((line) => line.category.homeId === null);

  const incomeCents = household
    .filter((l) => l.category.kind === BudgetKind.INCOME)
    .reduce((sum, l) => sum + l.actualCents, 0);
  const plannedIncomeCents = household
    .filter((l) => l.category.kind === BudgetKind.INCOME)
    .reduce((sum, l) => sum + l.plannedCents, 0);

  const householdExpense = household
    .filter((l) => l.category.kind === BudgetKind.EXPENSE)
    .reduce((sum, l) => sum + l.actualCents, 0);
  const plannedHouseholdExpense = household
    .filter((l) => l.category.kind === BudgetKind.EXPENSE)
    .reduce((sum, l) => sum + l.plannedCents, 0);

  const homeActual = homeMonths.reduce((sum, h) => sum + h.totalCents, 0);
  const homePlanned = homeMonths.reduce(
    (sum, h) => sum + (h.budgetCents ?? h.totalCents),
    0,
  );

  const expenseCents = householdExpense + homeActual;
  const plannedExpenseCents = plannedHouseholdExpense + homePlanned;

  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    plannedIncomeCents,
    plannedExpenseCents,
    plannedNetCents: plannedIncomeCents - plannedExpenseCents,
  };
}

/**
 * Which lines belong in a given month.
 *
 * An archived category stops appearing in new months but must keep the months
 * it already has: money that was spent was still spent, and dropping it would
 * quietly change a past month's totals. So a category shows when it's live, or
 * when it had any activity that month.
 */
export function linesForMonth(lines: CategoryLine[]): CategoryLine[] {
  return lines.filter(
    (line) => !line.category.archived || line.actualCents !== 0,
  );
}

/** Sort order for display: user order, then name. */
export function sortCategories<T extends Pick<BudgetCategory, "sortOrder" | "name">>(
  categories: T[],
): T[] {
  return [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

export const CADENCE_LABELS: Record<Cadence, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
};

export const BUDGET_KIND_LABELS: Record<BudgetKind, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
};

/** Projects that were finished inside the month, for the house rollup. */
export function projectsCompletedIn(projects: Project[], month: Month): Project[] {
  const start = monthStart(month);
  const end = monthEnd(month);
  return projects.filter(
    (p) =>
      p.status === ProjectStatus.DONE &&
      p.completedOn !== null &&
      p.completedOn >= start &&
      p.completedOn < end,
  );
}
