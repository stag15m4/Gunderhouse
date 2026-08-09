import Link from "next/link";
import { BudgetKind } from "@prisma/client";
import { requireUser, visibleHomes } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  buildCategoryLine,
  buildHomeMonth,
  monthEnd,
  monthKey,
  monthStart,
  linesForMonth,
  projectsCompletedIn,
  sortCategories,
  summarise,
  type Month,
} from "@/lib/budget";
import { formatMoney } from "@/lib/format";
import { Empty, PageHeader, Section } from "@/components/ui";

/**
 * Twelve months side by side. Everything is recomputed per month rather than
 * summed from a cache, so a recurring charge that started in June shows up in
 * June and not before.
 */
export default async function BudgetYearPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string }>;
}) {
  const user = await requireUser();
  const { y } = await searchParams;
  const now = new Date();
  const year = /^\d{4}$/.test(y ?? "") ? Number(y) : now.getUTCFullYear();

  const homes = await visibleHomes(user);
  const homeIds = homes.map((h) => h.id);
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));

  const [categories, entries, maintenance, projects, appliances] =
    await Promise.all([
      prisma.budgetCategory.findMany({ include: { recurring: true } }),
      prisma.budgetEntry.findMany({
        where: { occurredOn: { gte: from, lt: to } },
      }),
      prisma.maintenanceEntry.findMany({
        where: { homeId: { in: homeIds }, performedOn: { gte: from, lt: to } },
      }),
      prisma.project.findMany({ where: { homeId: { in: homeIds } } }),
      prisma.appliance.findMany({ where: { homeId: { in: homeIds } } }),
    ]);

  const sorted = sortCategories(categories);

  const months: Array<{
    month: Month;
    income: number;
    expense: number;
    net: number;
  }> = [];

  for (let m = 1; m <= 12; m += 1) {
    const month = { year, month: m };
    const start = monthStart(month);
    const end = monthEnd(month);

    const lines = linesForMonth(sorted.map((category) =>
      buildCategoryLine(
        category,
        entries.filter(
          (e) =>
            e.categoryId === category.id &&
            e.occurredOn >= start &&
            e.occurredOn < end,
        ),
        month,
      ),
    ));

    const homeMonths = homes.map((home) =>
      buildHomeMonth({
        home,
        maintenance: maintenance.filter(
          (e) =>
            e.homeId === home.id &&
            e.performedOn >= start &&
            e.performedOn < end,
        ),
        projects: projectsCompletedIn(
          projects.filter((p) => p.homeId === home.id),
          month,
        ),
        categoryLines: lines,
        appliances: appliances.filter((a) => a.homeId === home.id),
      }),
    );

    const totals = summarise(lines, homeMonths);
    months.push({
      month,
      income: totals.incomeCents,
      expense: totals.expenseCents,
      net: totals.netCents,
    });
  }

  const yearIncome = months.reduce((s, m) => s + m.income, 0);
  const yearExpense = months.reduce((s, m) => s + m.expense, 0);
  const hasAnything = yearIncome !== 0 || yearExpense !== 0;

  return (
    <>
      <PageHeader
        title={`${year}`}
        subtitle="Every month side by side. Recurring charges are spread evenly; one-offs land where they happened."
        backHref="/budget"
        backLabel="Budget"
      />

      <div className="flex items-center justify-between gap-3">
        <Link className="btn-secondary" href={`/budget/year?y=${year - 1}`}>
          ← {year - 1}
        </Link>
        <Link className="btn-secondary" href={`/budget/year?y=${year + 1}`}>
          {year + 1} →
        </Link>
      </div>

      <Section title="Year to date">
        <div className="grid grid-cols-3 gap-3">
          <Figure label="Income" value={formatMoney(yearIncome)} />
          <Figure label="Expenses" value={formatMoney(yearExpense)} />
          <Figure
            label="Left over"
            value={formatMoney(yearIncome - yearExpense)}
            tone={yearIncome - yearExpense < 0 ? "bad" : "good"}
          />
        </div>
      </Section>

      <Section title="By month">
        {!hasAnything ? (
          <Empty>Nothing recorded for {year} yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[30rem]">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Income</th>
                  <th className="text-right">Expenses</th>
                  <th className="text-right">Left over</th>
                </tr>
              </thead>
              <tbody>
                {months.map((row) => (
                  <tr key={row.month.month}>
                    <td>
                      <Link
                        className="text-[var(--text)] hover:underline"
                        href={`/budget?m=${monthKey(row.month)}`}
                      >
                        {new Date(
                          Date.UTC(year, row.month.month - 1, 1),
                        ).toLocaleDateString("en-US", {
                          month: "long",
                          timeZone: "UTC",
                        })}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">
                      {formatMoney(row.income)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatMoney(row.expense)}
                    </td>
                    <td
                      className={`text-right font-medium tabular-nums ${row.net < 0 ? "text-[#f87171]" : "text-[var(--text)]"}`}
                    >
                      {formatMoney(row.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const colour =
    tone === "bad"
      ? "text-[#f87171]"
      : tone === "good"
        ? "text-[var(--accent)]"
        : "text-[var(--text)]";
  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
        {label}
      </div>
      <div className={`mt-1 text-lg font-medium tabular-nums ${colour}`}>
        {value}
      </div>
    </div>
  );
}
