import { notFound } from "next/navigation";
import { HomeRole } from "@prisma/client";
import { updateMaintenanceEntry } from "@/app/actions/maintenance";
import { requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { dateInputValue } from "@/lib/format";
import {
  Field,
  FormError,
  PageHeader,
  SelectField,
  TextareaField,
} from "@/components/ui";

export default async function EditMaintenanceEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string; entryId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { homeId, entryId } = await params;
  const { error } = await searchParams;
  const { home } = await requireHome(homeId, HomeRole.MEMBER);

  const [entry, appliances] = await Promise.all([
    prisma.maintenanceEntry.findUnique({ where: { id: entryId } }),
    prisma.appliance.findMany({
      where: { homeId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!entry || entry.homeId !== homeId) notFound();

  const update = updateMaintenanceEntry.bind(null, homeId, entryId);

  return (
    <>
      <PageHeader
        title="Edit maintenance entry"
        subtitle={home.name}
        backHref={`/homes/${homeId}/maintenance`}
        backLabel="Maintenance log"
      />
      <FormError message={error} />

      <form action={update} className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Date"
            name="performedOn"
            type="date"
            required
            defaultValue={dateInputValue(entry.performedOn)}
          />
          <SelectField
            label="Appliance or system"
            name="applianceId"
            includeBlank="Home-level (not a specific item)"
            defaultValue={entry.applianceId}
            options={appliances.map((a) => ({ value: a.id, label: a.name }))}
          />
          <Field
            label="Cost"
            name="cost"
            defaultValue={
              entry.costCents === null ? "" : (entry.costCents / 100).toFixed(2)
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Description"
            name="description"
            required
            defaultValue={entry.description}
          />
          <Field label="Vendor" name="vendor" defaultValue={entry.vendor} />
        </div>
        <TextareaField label="Notes" name="notes" rows={2} defaultValue={entry.notes} />
        <button className="btn" type="submit">
          Save changes
        </button>
      </form>
    </>
  );
}
