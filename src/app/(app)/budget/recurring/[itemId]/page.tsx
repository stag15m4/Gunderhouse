import { notFound } from "next/navigation";
import { Cadence } from "@prisma/client";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { CADENCE_LABELS, monthlyEquivalent, sortCategories } from "@/lib/budget";
import { deleteRecurring, updateRecurring } from "@/app/actions/budget";
import { dateInputValue, formatMoney } from "@/lib/format";
import {
  Field,
  FormError,
  PageHeader,
  Section,
  SelectField,
  TextareaField,
} from "@/components/ui";

export default async function RecurringPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { itemId } = await params;
  const { error } = await searchParams;
  await requireUser();

  const item = await prisma.recurringItem.findUnique({ where: { id: itemId } });
  if (!item) notFound();

  const categories = sortCategories(
    await prisma.budgetCategory.findMany({ where: { archived: false } }),
  );

  const update = updateRecurring.bind(null, itemId);
  const remove = deleteRecurring.bind(null, itemId);
  const monthly = monthlyEquivalent(item.amountCents, item.cadence);

  return (
    <>
      <PageHeader
        title={item.label}
        subtitle={`${formatMoney(item.amountCents)} ${CADENCE_LABELS[item.cadence].toLowerCase()} · ${formatMoney(monthly)}/mo`}
        backHref="/budget/setup"
        backLabel="Budget setup"
      />

      <FormError message={error} />

      <Section title="Details">
        <form action={update} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="What is it"
              name="label"
              required
              defaultValue={item.label}
            />
            <SelectField
              label="Category"
              name="categoryId"
              defaultValue={item.categoryId}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Amount"
              name="amount"
              required
              defaultValue={(item.amountCents / 100).toFixed(2)}
            />
            <SelectField
              label="How often"
              name="cadence"
              defaultValue={item.cadence}
              options={Object.entries(CADENCE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Starts"
              name="startsOn"
              type="date"
              defaultValue={dateInputValue(item.startsOn)}
              hint="Optional. Months before this don't count it."
            />
            <Field
              label="Ends"
              name="endsOn"
              type="date"
              defaultValue={dateInputValue(item.endsOn)}
              hint="Optional. Set this when you cancel."
            />
          </div>
          <TextareaField
            label="Notes"
            name="notes"
            rows={2}
            defaultValue={item.notes}
          />
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              name="active"
              defaultChecked={item.active}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Still active
          </label>
          <button className="btn" type="submit">
            Save changes
          </button>
        </form>
      </Section>

      <Section
        title="Delete"
        description="Removes it from every month, past ones included. To stop it going forward, set an end date instead."
      >
        <form action={remove}>
          <button className="btn-danger" type="submit">
            Delete this charge
          </button>
        </form>
      </Section>
    </>
  );
}
