import Link from "next/link";
import { canAdminister, canEdit, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  createMaintenanceEntry,
  deleteMaintenanceEntry,
} from "@/app/actions/maintenance";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Empty,
  Field,
  FormError,
  PageHeader,
  SelectField,
  Section,
  TextareaField,
} from "@/components/ui";

export default async function MaintenancePage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>;
  searchParams: Promise<{ error?: string; year?: string }>;
}) {
  const { homeId } = await params;
  const { error, year } = await searchParams;
  const { home, role } = await requireHome(homeId);

  const selectedYear = year ? Number.parseInt(year, 10) : null;
  const yearFilter =
    selectedYear && Number.isFinite(selectedYear)
      ? {
          performedOn: {
            gte: new Date(Date.UTC(selectedYear, 0, 1)),
            lt: new Date(Date.UTC(selectedYear + 1, 0, 1)),
          },
        }
      : {};

  const [entries, appliances, total] = await Promise.all([
    prisma.maintenanceEntry.findMany({
      where: { homeId, ...yearFilter },
      orderBy: { performedOn: "desc" },
      include: {
        appliance: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.appliance.findMany({
      where: { homeId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.maintenanceEntry.aggregate({
      where: { homeId, ...yearFilter },
      _sum: { costCents: true },
    }),
  ]);

  const logWork = createMaintenanceEntry.bind(null, homeId);

  return (
    <>
      <PageHeader
        title="Maintenance log"
        subtitle={`${home.name} · ${entries.length} entries · ${formatMoney(
          total._sum.costCents ?? 0,
        )} total`}
        backHref={`/homes/${homeId}`}
        backLabel={home.name}
      />

      <FormError message={error} />

      {canEdit(role) ? (
        <Section
          title="Log work"
          description="Leave the appliance blank for home-level work like roofing or landscaping."
        >
          <form action={logWork} className="space-y-4">
            <input
              type="hidden"
              name="returnTo"
              value={`/homes/${homeId}/maintenance`}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date" name="performedOn" type="date" required />
              <SelectField
                label="Appliance or system"
                name="applianceId"
                includeBlank="Home-level (not a specific item)"
                options={appliances.map((a) => ({ value: a.id, label: a.name }))}
              />
              <Field label="Cost" name="cost" placeholder="0.00" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Description"
                name="description"
                required
                placeholder="Annual furnace service"
              />
              <Field
                label="Vendor"
                name="vendor"
                placeholder="Who did the work"
              />
            </div>
            <TextareaField label="Notes" name="notes" rows={2} />
            <button className="btn" type="submit">
              Add entry
            </button>
          </form>
        </Section>
      ) : null}

      <div className="card p-4">
        {entries.length === 0 ? (
          <Empty>No maintenance logged yet.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th>Item</th>
                <th>Vendor</th>
                <th className="text-right">Cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap">
                    {formatDate(entry.performedOn)}
                  </td>
                  <td>
                    {entry.description}
                    {entry.notes ? (
                      <div className="text-xs text-stone-500">{entry.notes}</div>
                    ) : null}
                    {entry.createdBy ? (
                      <div className="text-xs text-stone-400">
                        Logged by {entry.createdBy.name}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {entry.appliance ? (
                      <Link
                        className="hover:underline"
                        href={`/homes/${homeId}/appliances/${entry.appliance.id}`}
                      >
                        {entry.appliance.name}
                      </Link>
                    ) : (
                      <span className="text-stone-400">Home-level</span>
                    )}
                  </td>
                  <td>{entry.vendor ?? "—"}</td>
                  <td className="text-right">{formatMoney(entry.costCents)}</td>
                  <td className="whitespace-nowrap text-right">
                    {canEdit(role) ? (
                      <Link
                        className="text-xs text-stone-500 hover:text-stone-900"
                        href={`/homes/${homeId}/maintenance/${entry.id}/edit`}
                      >
                        Edit
                      </Link>
                    ) : null}
                    {canAdminister(role) ? (
                      <form
                        className="mt-1"
                        action={deleteMaintenanceEntry.bind(
                          null,
                          homeId,
                          entry.id,
                        )}
                      >
                        <button
                          className="text-xs text-red-600 hover:text-red-800"
                          type="submit"
                        >
                          Delete
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
