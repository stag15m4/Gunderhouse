import Link from "next/link";
import { canAdminister, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { buildForecast, upcomingOnly } from "@/lib/forecast";
import { formatAddress, formatDate, formatMoney } from "@/lib/format";
import {
  APPLIANCE_CATEGORY_LABELS,
  HOME_ROLE_SHORT,
  HOME_TYPE_LABELS,
} from "@/lib/labels";
import {
  Badge,
  Empty,
  ForecastBadge,
  PageHeader,
  Section,
} from "@/components/ui";

export default async function HomeOverviewPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const { home, role } = await requireHome(homeId);

  const [appliances, recentMaintenance, spend, documentCount] = await Promise.all([
    prisma.appliance.findMany({
      where: { homeId },
      select: {
        id: true,
        homeId: true,
        name: true,
        category: true,
        location: true,
        installedOn: true,
        warrantyExpiresOn: true,
      },
    }),
    prisma.maintenanceEntry.findMany({
      where: { homeId },
      orderBy: { performedOn: "desc" },
      take: 5,
      include: { appliance: { select: { name: true } } },
    }),
    prisma.maintenanceEntry.aggregate({
      where: {
        homeId,
        performedOn: { gte: new Date(new Date().getFullYear(), 0, 1) },
      },
      _sum: { costCents: true },
    }),
    prisma.document.count({ where: { homeId } }),
  ]);

  const upcoming = upcomingOnly(buildForecast(appliances)).slice(0, 5);
  const address = formatAddress(home);

  return (
    <>
      <PageHeader
        title={home.name}
        subtitle={address || undefined}
        backHref="/homes"
        backLabel="Homes"
        actions={
          canAdminister(role) ? (
            <Link className="btn-secondary" href={`/homes/${homeId}/edit`}>
              Edit home
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Type" value={HOME_TYPE_LABELS[home.type]} />
        <Stat label="Appliances & systems" value={String(appliances.length)} />
        <Stat
          label={`Maintenance spend, ${new Date().getFullYear()}`}
          value={formatMoney(spend._sum.costCents ?? 0)}
        />
        <Stat label="Documents" value={String(documentCount)} />
      </div>

      <Section
        title="Coming due"
        description="Based on in-service date versus typical service life."
        actions={
          <Link
            className="text-sm text-stone-600 hover:text-stone-900"
            href="/forecast"
          >
            Full forecast →
          </Link>
        }
      >
        {upcoming.length === 0 ? (
          <Empty>
            Nothing flagged. Appliances without an in-service date aren&apos;t
            forecast.
          </Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>In service</th>
                <th>Expected life</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((item) => (
                <tr key={item.applianceId}>
                  <td>
                    <Link
                      className="font-medium text-stone-900 hover:underline"
                      href={`/homes/${homeId}/appliances/${item.applianceId}`}
                    >
                      {item.name}
                    </Link>
                    <div className="text-xs text-stone-500">
                      {APPLIANCE_CATEGORY_LABELS[item.category]}
                    </div>
                  </td>
                  <td>
                    {formatDate(item.installedOn)}
                    <div className="text-xs text-stone-500">
                      {item.ageYears} yrs old
                    </div>
                  </td>
                  <td>
                    {item.lifespanLow}–{item.lifespanHigh} yrs
                  </td>
                  <td>
                    <ForecastBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Recent maintenance"
        actions={
          <Link
            className="text-sm text-stone-600 hover:text-stone-900"
            href={`/homes/${homeId}/maintenance`}
          >
            Full log →
          </Link>
        }
      >
        {recentMaintenance.length === 0 ? (
          <Empty>No maintenance logged yet.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th>Vendor</th>
                <th className="text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {recentMaintenance.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap">
                    {formatDate(entry.performedOn)}
                  </td>
                  <td>
                    {entry.description}
                    <div className="text-xs text-stone-500">
                      {entry.appliance?.name ?? "Home-level"}
                    </div>
                  </td>
                  <td>{entry.vendor ?? "—"}</td>
                  <td className="text-right">{formatMoney(entry.costCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {home.notes ? (
        <Section title="Notes">
          <p className="whitespace-pre-wrap text-sm text-stone-700">
            {home.notes}
          </p>
        </Section>
      ) : null}

      <div className="mb-6 grid gap-4 text-sm text-stone-600 sm:grid-cols-3">
        <Fact label="Year built" value={home.yearBuilt?.toString()} />
        <Fact
          label="Square feet"
          value={home.squareFeet?.toLocaleString("en-US")}
        />
        <Fact label="Purchased" value={formatDate(home.purchasedOn)} />
      </div>

      <p className="text-xs text-stone-500">
        Your access to this home: <Badge>{HOME_ROLE_SHORT[role]}</Badge>
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-stone-900">{value}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-stone-500">{label}: </span>
      <span>{value || "—"}</span>
    </div>
  );
}
