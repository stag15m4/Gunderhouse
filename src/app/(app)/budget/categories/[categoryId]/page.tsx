import { notFound } from "next/navigation";
import { BudgetKind, BudgetVisibility } from "@prisma/client";
import { visibleHomes } from "@/lib/access";
import {
  BUDGET_VISIBILITY_LABELS,
  requireBudgetAdminPage,
} from "@/lib/budget-access";
import { prisma } from "@/lib/prisma";
import { archiveCategory, updateCategory } from "@/app/actions/budget";
import {
  Field,
  FormError,
  PageHeader,
  Section,
  SelectField,
} from "@/components/ui";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { categoryId } = await params;
  const { error } = await searchParams;
  const user = await requireBudgetAdminPage();

  const category = await prisma.budgetCategory.findUnique({
    where: { id: categoryId },
  });
  if (!category) notFound();

  const homes = await visibleHomes(user);
  const update = updateCategory.bind(null, categoryId);
  const remove = archiveCategory.bind(null, categoryId);

  return (
    <>
      <PageHeader
        title={category.name}
        subtitle="Budget category"
        backHref="/budget/setup"
        backLabel="Budget setup"
      />

      <FormError message={error} />

      <Section title="Details">
        <form action={update} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              name="name"
              required
              defaultValue={category.name}
            />
            <SelectField
              label="Kind"
              name="kind"
              defaultValue={category.kind}
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
              defaultValue={
                category.monthlyTargetCents !== null
                  ? (category.monthlyTargetCents / 100).toFixed(2)
                  : ""
              }
              hint="Leave blank to track without a target."
            />
            <SelectField
              label="Belongs to a house"
              name="homeId"
              defaultValue={category.homeId ?? ""}
              includeBlank="Household-wide"
              options={homes.map((h) => ({ value: h.id, label: h.name }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Who can see it"
              name="visibility"
              defaultValue={category.visibility}
              options={Object.entries(BUDGET_VISIBILITY_LABELS).map(
                ([value, label]) => ({ value, label }),
              )}
              hint="Restricting a category hides its charges and everything logged against it."
            />
            <label className="flex items-end gap-2 pb-3 text-sm text-[var(--muted)]">
              <input
                type="checkbox"
                name="assistantAccess"
                defaultChecked={category.assistantAccess}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Alfred and Lucy can read it
            </label>
          </div>
          <Field
            label="Sort order"
            name="sortOrder"
            type="number"
            defaultValue={String(category.sortOrder)}
            hint="Lower shows first."
          />
          <button className="btn" type="submit">
            Save changes
          </button>
        </form>
      </Section>

      <Section
        title="Remove"
        description="Categories with history are archived rather than deleted, so past months keep their numbers."
      >
        <form action={remove}>
          <button className="btn-danger" type="submit">
            Remove this category
          </button>
        </form>
      </Section>
    </>
  );
}
