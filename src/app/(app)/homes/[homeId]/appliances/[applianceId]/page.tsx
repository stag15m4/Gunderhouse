import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { forecastAppliance } from "@/lib/forecast";
import { createMaintenanceEntry } from "@/app/actions/maintenance";
import { formatDate, formatDollars, formatMoney } from "@/lib/format";
import { APPLIANCE_CATEGORY_LABELS } from "@/lib/labels";
import {
  Empty,
  Field,
  ForecastBadge,
  FormError,
  PageHeader,
  Section,
  TextareaField,
} from "@/components/ui";

export default async function ApplianceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string; applianceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { homeId, applianceId } = await params;
  const { error } = await searchParams;
  const { home, role } = await requireHome(homeId);

  const appliance = await prisma.appliance.findUnique({
    where: { id: applianceId },
    include: {
      maintenance: {
        orderBy: { performedOn: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  if (!appliance || appliance.homeId !== homeId) notFound();

  const forecast = forecastAppliance(appliance);
  const logWork = createMaintenanceEntry.bind(null, homeId);
  const totalSpend = appliance.maintenance.reduce(
    (sum, entry) => sum + (entry.costCents ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title={appliance.name}
        subtitle={`${APPLIANCE_CATEGORY_LABELS[appliance.category]} · ${home.name}`}
        backHref={`/homes/${homeId}/appliances`}
        backLabel="Appliances & systems"
        actions={
          canEdit(role) ? (
            <Link
              className="btn-secondary"
              href={`/homes/${homeId}/appliances/${applianceId}/edit`}
            >
              Edit
            </Link>
          ) : null
        }
      />

      <FormError message={error} />

      <Section title="Details">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Detail label="Brand" value={appliance.brand} />
          <Detail label="Model number" value={appliance.modelNumber} />
          <Detail label="Serial number" value={appliance.serialNumber} />
          <Detail label="Location" value={appliance.location} />
          <Detail label="In service since" value={formatDate(appliance.installedOn)} />
          <Detail
            label="Warranty expires"
            value={formatDate(appliance.warrantyExpiresOn)}
          />
        </dl>
        {appliance.notes ? (
          <p className="mt-4 whitespace-pre-wrap border-t border-[var(--border-soft)] pt-4 text-sm text-[var(--muted)]">
            {appliance.notes}
          </p>
        ) : null}
      </Section>

      <Section title="Forecast">
        {forecast ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--muted)]">
            <ForecastBadge status={forecast.status} size="lg" />
            <span>{forecast.ageYears} years in service</span>
            <span>
              Typical life {forecast.lifespanLow}–{forecast.lifespanHigh} years
            </span>
            <span>
              Replacement window starts {forecast.expectedReplacementYear}
            </span>
            {forecast.estimatedCost ? (
              <span>
                Rough replacement cost {formatDollars(forecast.estimatedCost)}
              </span>
            ) : null}
          </div>
        ) : (
          <Empty>
            Add an in-service date to include this item in the forecast.
          </Empty>
        )}
      </Section>

      <Section
        title="Maintenance history"
        description={
          appliance.maintenance.length
            ? `${appliance.maintenance.length} entries · ${formatMoney(totalSpend)} total`
            : undefined
        }
      >
        {appliance.maintenance.length === 0 ? (
          <Empty>Nothing logged for this item yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[36rem]">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th>Vendor</th>
                <th className="text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {appliance.maintenance.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap">
                    {formatDate(entry.performedOn)}
                  </td>
                  <td>
                    {entry.description}
                    {entry.notes ? (
                      <div className="text-xs text-[var(--subtle)]">{entry.notes}</div>
                    ) : null}
                  </td>
                  <td>{entry.vendor ?? "—"}</td>
                  <td className="text-right">{formatMoney(entry.costCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Section>

      {canEdit(role) ? (
        <Section title="Log work on this item">
          <form action={logWork} className="space-y-4">
            <input type="hidden" name="applianceId" value={applianceId} />
            <input
              type="hidden"
              name="returnTo"
              value={`/homes/${homeId}/appliances/${applianceId}`}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date" name="performedOn" type="date" required />
              <Field label="Vendor" name="vendor" placeholder="Who did the work" />
              <Field label="Cost" name="cost" placeholder="0.00" />
            </div>
            <Field
              label="Description"
              name="description"
              required
              placeholder="Flushed tank, replaced anode rod"
            />
            <TextareaField label="Notes" name="notes" rows={2} />
            <button className="btn" type="submit">
              Add entry
            </button>
          </form>
        </Section>
      ) : null}
    </>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--subtle)]">{label}</dt>
      <dd className="text-[var(--text)]">{value || "—"}</dd>
    </div>
  );
}
