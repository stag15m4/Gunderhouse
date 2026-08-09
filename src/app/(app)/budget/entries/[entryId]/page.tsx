import { notFound } from "next/navigation";
import { BudgetKind } from "@prisma/client";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { sortCategories } from "@/lib/budget";
import { deleteEntry, updateEntry } from "@/app/actions/budget";
import { dateInputValue } from "@/lib/format";
import {
  Field,
  FormError,
  PageHeader,
  Section,
  SelectField,
} from "@/components/ui";

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { entryId } = await params;
  const { error, from } = await searchParams;
  await requireUser();

  const entry = await prisma.budgetEntry.findUnique({ where: { id: entryId } });
  if (!entry) notFound();

  const categories = sortCategories(
    await prisma.budgetCategory.findMany({ where: { archived: false } }),
  );

  const back = from && /^\/[A-Za-z0-9/_?=-]*$/.test(from) ? from : "/budget";
  const update = updateEntry.bind(null, entryId);
  const remove = deleteEntry.bind(null, entryId);

  return (
    <>
      <PageHeader
        title="Logged amount"
        subtitle={entry.description ?? undefined}
        backHref={back}
        backLabel="Budget"
      />

      <FormError message={error} />

      <Section title="Details">
        <form action={update} className="space-y-4">
          <input type="hidden" name="returnTo" value={back} />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Category"
              name="categoryId"
              defaultValue={entry.categoryId}
              options={categories.map((c) => ({
                value: c.id,
                label:
                  c.kind === BudgetKind.INCOME ? `${c.name} (income)` : c.name,
              }))}
            />
            <Field
              label="Amount"
              name="amount"
              required
              defaultValue={(entry.amountCents / 100).toFixed(2)}
            />
            <Field
              label="Date"
              name="occurredOn"
              type="date"
              defaultValue={dateInputValue(entry.occurredOn)}
            />
          </div>
          <Field
            label="Note"
            name="description"
            defaultValue={entry.description ?? ""}
          />
          <button className="btn" type="submit">
            Save changes
          </button>
        </form>
      </Section>

      <Section title="Delete">
        <form action={remove}>
          <input type="hidden" name="returnTo" value={back} />
          <button className="btn-danger" type="submit">
            Delete this entry
          </button>
        </form>
      </Section>
    </>
  );
}
