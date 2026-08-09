import Link from "next/link";
import { BudgetKind, Cadence } from "@prisma/client";
import { requireUser, visibleHomes } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  CADENCE_LABELS,
  monthlyEquivalent,
  sortCategories,
} from "@/lib/budget";
import {
  archiveCategory,
  createCategory,
  createRecurring,
  restoreCategory,
} from "@/app/actions/budget";
import { formatMoney } from "@/lib/format";
import {
  Badge,
  Empty,
  Field,
  FormError,
  PageHeader,
  Section,
  SelectField,
} from "@/components/ui";

export default async function BudgetSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { error } = await searchParams;

  const homes = await visibleHomes(user);
  const categories = await prisma.budgetCategory.findMany({
    include: { recurring: { orderBy: { label: "asc" } }, home: true },
  });

  const live = sortCategories(categories.filter((c) => !c.archived));
  const archived = categories.filter((c) => c.archived);

  return (
    <>
      <PageHeader
        title="Budget setup"
        subtitle="Categories, targets, and the charges that repeat on their own."
        backHref="/budget"
        backLabel="Budget"
      />

      <FormError message={error} />

      <Section
        title="Categories"
        description="A target is optional. Without one the category is tracked but not judged."
      >
        {live.length === 0 ? (
          <Empty>Nothing set up yet. Add your first category below.</Empty>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {live.map((category) => {
              const monthly = category.recurring
                .filter((i) => i.active)
                .reduce(
                  (sum, i) => sum + monthlyEquivalent(i.amountCents, i.cadence),
                  0,
                );
              return (
                <li key={category.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text)]">
                          {category.name}
                        </span>
                        {category.kind === BudgetKind.INCOME ? (
                          <Badge tone="green">Income</Badge>
                        ) : null}
                        {category.home ? (
                          <Badge tone="neutral">{category.home.name}</Badge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--subtle)]">
                        {category.monthlyTargetCents === null
                          ? "no monthly target"
                          : `target ${formatMoney(category.monthlyTargetCents)}/mo`}
                        {monthly > 0
                          ? ` · ${formatMoney(monthly)}/mo committed`
                          : ""}
                      </div>
                      {category.recurring.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {category.recurring.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span
                                className={
                                  item.active
                                    ? "text-[var(--muted)]"
                                    : "text-[var(--faint)] line-through"
                                }
                              >
                                {item.label}
                              </span>
                              <span className="tabular-nums text-[var(--subtle)]">
                                {formatMoney(item.amountCents)}{" "}
                                {CADENCE_LABELS[item.cadence].toLowerCase()}
                              </span>
                              <Link
                                className="text-[var(--faint)] hover:text-[var(--text)]"
                                href={`/budget/recurring/${item.id}`}
                              >
                                edit
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Link
                        className="text-xs text-[var(--subtle)] hover:text-[var(--text)]"
                        href={`/budget/categories/${category.id}`}
                      >
                        Edit
                      </Link>
                      <form action={archiveCategory.bind(null, category.id)}>
                        <button
                          className="text-xs text-[var(--faint)] hover:text-[#f87171]"
                          type="submit"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <details className="mt-4 border-t border-[var(--border-soft)] pt-4">
          <summary className="cursor-pointer text-sm font-medium text-[var(--muted)]">
            Add a category
          </summary>
          <form action={createCategory} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Name"
                name="name"
                required
                placeholder="Groceries"
              />
              <SelectField
                label="Kind"
                name="kind"
                defaultValue={BudgetKind.EXPENSE}
                options={[
                  { value: BudgetKind.EXPENSE, label: "Expense" },
                  { value: BudgetKind.INCOME, label: "Income" },
                ]}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Monthly target"
                name="monthlyTarget"
                placeholder="1200"
                hint="Optional."
              />
              <SelectField
                label="Belongs to a house"
                name="homeId"
                includeBlank="Household-wide"
                options={homes.map((h) => ({ value: h.id, label: h.name }))}
                hint="Only for costs tied to one house, like its insurance."
              />
            </div>
            <button className="btn" type="submit">
              Add category
            </button>
          </form>
        </details>
      </Section>

      <Section
        title="Recurring charges"
        description="Entered once and counted every month after — subscriptions, premiums, payments. Nothing to confirm each month."
      >
        {live.length === 0 ? (
          <Empty>Add a category first.</Empty>
        ) : (
          <form action={createRecurring} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="What is it"
                name="label"
                required
                placeholder="Disney+"
              />
              <SelectField
                label="Category"
                name="categoryId"
                options={live.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Amount"
                name="amount"
                required
                placeholder="15.99"
              />
              <SelectField
                label="How often"
                name="cadence"
                defaultValue={Cadence.MONTHLY}
                options={Object.entries(CADENCE_LABELS).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
            </div>
            <button className="btn" type="submit">
              Add charge
            </button>
          </form>
        )}
      </Section>

      {archived.length > 0 ? (
        <Section
          title="Removed"
          description="Kept because they carry history. Restore one to use it again."
        >
          <ul className="divide-y divide-[var(--border)]">
            {archived.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-[var(--muted)]">
                  {category.name}
                </span>
                <form action={restoreCategory.bind(null, category.id)}>
                  <button className="btn-secondary" type="submit">
                    Restore
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
