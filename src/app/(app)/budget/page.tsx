import Link from "next/link";
import { BudgetKind } from "@prisma/client";
import { requireUser, visibleHomes } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  buildCategoryLine,
  buildHomeMonth,
  monthEnd,
  monthKey,
  monthLabel,
  monthStart,
  parseMonth,
  projectsCompletedIn,
  shiftMonth,
  sortCategories,
  summarise,
  linesForMonth,
  type CategoryLine,
} from "@/lib/budget";
import { createEntry } from "@/app/actions/budget";
import { formatMoney } from "@/lib/format";
import {
  Empty,
  Field,
  FormError,
  PageHeader,
  Section,
  SelectField,
} from "@/components/ui";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { m, error } = await searchParams;
  const month = parseMonth(m);
  const start = monthStart(month);
  const end = monthEnd(month);

  const homes = await visibleHomes(user);
  const homeIds = homes.map((h) => h.id);

  const [categories, entries, maintenance, projects, appliances] =
    await Promise.all([
      // Archived categories are fetched too: one may still carry this month's
      // history, and its name is needed to label entries logged against it.
      prisma.budgetCategory.findMany({ include: { recurring: true } }),
      prisma.budgetEntry.findMany({
        where: { occurredOn: { gte: start, lt: end } },
        orderBy: { occurredOn: "desc" },
      }),
      prisma.maintenanceEntry.findMany({
        where: { homeId: { in: homeIds }, performedOn: { gte: start, lt: end } },
      }),
      prisma.project.findMany({ where: { homeId: { in: homeIds } } }),
      prisma.appliance.findMany({ where: { homeId: { in: homeIds } } }),
    ]);

  const entriesByCategory = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = entriesByCategory.get(entry.categoryId) ?? [];
    list.push(entry);
    entriesByCategory.set(entry.categoryId, list);
  }

  const lines = linesForMonth(
    sortCategories(categories).map((category) =>
      buildCategoryLine(
        category,
        entriesByCategory.get(category.id) ?? [],
        month,
      ),
    ),
  );
  const liveCategories = sortCategories(categories.filter((c) => !c.archived));

  const homeMonths = homes.map((home) =>
    buildHomeMonth({
      home,
      maintenance: maintenance.filter((e) => e.homeId === home.id),
      projects: projectsCompletedIn(
        projects.filter((p) => p.homeId === home.id),
        month,
      ),
      categoryLines: lines,
      appliances: appliances.filter((a) => a.homeId === home.id),
    }),
  );

  const totals = summarise(lines, homeMonths);
  const income = lines.filter(
    (l) => l.category.kind === BudgetKind.INCOME && l.category.homeId === null,
  );
  const expenses = lines.filter(
    (l) => l.category.kind === BudgetKind.EXPENSE && l.category.homeId === null,
  );
  const reserveTotal = homeMonths.reduce((s, h) => s + h.reserveCents, 0);

  const prev = monthKey(shiftMonth(month, -1));
  const next = monthKey(shiftMonth(month, 1));
  const here = `/budget?m=${monthKey(month)}`;

  return (
    <>
      <PageHeader
        title="Budget"
        subtitle="Income, recurring costs, and what the houses are costing. Everything is shown as a monthly figure."
        actions={
          <Link className="btn-secondary" href="/budget/setup">
            Set up
          </Link>
        }
      />

      <FormError message={error} />

      <div className="flex items-center justify-between gap-3">
        <Link className="btn-secondary" href={`/budget?m=${prev}`}>
          ← Previous
        </Link>
        <div className="text-sm font-medium text-[var(--text)]">
          {monthLabel(month)}
        </div>
        <Link className="btn-secondary" href={`/budget?m=${next}`}>
          Next →
        </Link>
      </div>

      <Section title="This month">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Figure
            label="Income"
            value={formatMoney(totals.incomeCents)}
            sub={`planned ${formatMoney(totals.plannedIncomeCents)}`}
          />
          <Figure
            label="Expenses"
            value={formatMoney(totals.expenseCents)}
            sub={`planned ${formatMoney(totals.plannedExpenseCents)}`}
          />
          <Figure
            label="Left over"
            value={formatMoney(totals.netCents)}
            tone={totals.netCents < 0 ? "bad" : "good"}
            sub={`planned ${formatMoney(totals.plannedNetCents)}`}
            wide
          />
        </div>
        {reserveTotal > 0 ? (
          <p className="mt-3 text-xs text-[var(--subtle)]">
            Separately, the houses accrue about{" "}
            <span className="text-[var(--text)]">
              {formatMoney(reserveTotal)}
            </span>{" "}
            a month in appliance and system replacement. That&apos;s saving, not
            spending — it isn&apos;t counted above.
          </p>
        ) : null}
      </Section>

      {income.length > 0 ? (
        <Section title="Income">
          <LineTable lines={income} />
        </Section>
      ) : null}

      <Section
        title="Expenses"
        description="Recurring charges count automatically. Log the variable ones below."
      >
        {expenses.length === 0 ? (
          <Empty>
            No categories yet. Add groceries, subscriptions, and the rest under
            Set up.
          </Empty>
        ) : (
          <LineTable lines={expenses} />
        )}
      </Section>

      <Section
        title="Houses"
        description="Read from the maintenance log and finished projects — nothing to re-enter."
      >
        {homeMonths.length === 0 ? (
          <Empty>No homes yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[38rem]">
              <thead>
                <tr>
                  <th>Home</th>
                  <th className="text-right">Maintenance</th>
                  <th className="text-right">Projects</th>
                  <th className="text-right">Other</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Budget</th>
                  <th className="text-right">Set aside</th>
                </tr>
              </thead>
              <tbody>
                {homeMonths.map((h) => (
                  <tr key={h.homeId}>
                    <td>
                      <Link
                        className="font-medium text-[var(--text)] hover:underline"
                        href={`/homes/${h.homeId}`}
                      >
                        {h.homeName}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">
                      {formatMoney(h.maintenanceCents)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatMoney(h.projectCents)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatMoney(h.categoryCents)}
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      {formatMoney(h.totalCents)}
                    </td>
                    <td className="text-right tabular-nums">
                      {h.budgetCents === null ? (
                        <span className="text-[var(--faint)]">—</span>
                      ) : (
                        <span
                          className={
                            (h.varianceCents ?? 0) > 0
                              ? "text-[var(--danger,#f87171)]"
                              : "text-[var(--muted)]"
                          }
                        >
                          {formatMoney(h.budgetCents)}
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-[var(--subtle)]">
                      {formatMoney(h.reserveCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Log what you spent"
        description="One line a month per category is plenty — “groceries, $1,240”. More detail is allowed, never required."
      >
        {liveCategories.length === 0 ? (
          <Empty>Add a category first, under Set up.</Empty>
        ) : (
          <form action={createEntry} className="space-y-4">
            <input type="hidden" name="returnTo" value={here} />
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label="Category"
                name="categoryId"
                options={liveCategories.map((c) => ({
                  value: c.id,
                  label:
                    c.kind === BudgetKind.INCOME ? `${c.name} (income)` : c.name,
                }))}
              />
              <Field label="Amount" name="amount" required placeholder="1240" />
              <Field
                label="Date"
                name="occurredOn"
                type="date"
                defaultValue={monthKey(month) + "-01"}
              />
            </div>
            <Field label="Note" name="description" placeholder="Optional" />
            <button className="btn" type="submit">
              Log it
            </button>
          </form>
        )}
      </Section>

      {entries.length > 0 ? (
        <Section title={`Logged in ${monthLabel(month)}`}>
          <ul className="divide-y divide-[var(--border)]">
            {entries.map((entry) => {
              const category = categories.find(
                (c) => c.id === entry.categoryId,
              );
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--text)]">
                      {category?.name ?? "—"}
                    </div>
                    {entry.description ? (
                      <div className="text-xs text-[var(--subtle)]">
                        {entry.description}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums text-[var(--text)]">
                      {formatMoney(entry.amountCents)}
                    </span>
                    <Link
                      className="text-xs text-[var(--subtle)] hover:text-[var(--text)]"
                      href={`/budget/entries/${entry.id}?from=${encodeURIComponent(here)}`}
                    >
                      Edit
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

function LineTable({ lines }: { lines: CategoryLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table min-w-[32rem]">
        <thead>
          <tr>
            <th>Category</th>
            <th className="text-right">Planned</th>
            <th className="text-right">Actual</th>
            <th className="text-right">Difference</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.category.id}>
              <td>
                <div className="font-medium text-[var(--text)]">
                  {line.category.name}
                </div>
                {line.items.length > 0 ? (
                  <div className="text-xs text-[var(--subtle)]">
                    {line.items.map((i) => i.label).join(" · ")}
                  </div>
                ) : null}
              </td>
              <td className="text-right tabular-nums">
                {line.category.monthlyTargetCents === null ? (
                  <span className="text-[var(--faint)]">—</span>
                ) : (
                  formatMoney(line.plannedCents)
                )}
              </td>
              <td className="text-right font-medium tabular-nums">
                {formatMoney(line.actualCents)}
              </td>
              <td className="text-right tabular-nums">
                {line.varianceCents === null ? (
                  <span className="text-[var(--faint)]">—</span>
                ) : (
                  <span
                    className={
                      line.varianceCents > 0
                        ? "text-[#f87171]"
                        : "text-[#4ade80]"
                    }
                  >
                    {line.varianceCents > 0 ? "+" : ""}
                    {formatMoney(line.varianceCents)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Figure({
  label,
  value,
  sub,
  tone,
  wide,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
  wide?: boolean;
}) {
  const colour =
    tone === "bad"
      ? "text-[#f87171]"
      : tone === "good"
        ? "text-[var(--accent)]"
        : "text-[var(--text)]";
  return (
    <div
      className={`rounded-xl border border-[var(--border)] p-3 ${wide ? "col-span-2 sm:col-span-1" : ""}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
        {label}
      </div>
      <div className={`mt-1 text-lg font-medium tabular-nums ${colour}`}>
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-xs text-[var(--faint)]">{sub}</div>
      ) : null}
    </div>
  );
}
