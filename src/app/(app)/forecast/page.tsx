import Link from "next/link";
import { requireUser, visibleHomeIds } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { buildForecast } from "@/lib/forecast";
import { formatDate, formatDollars } from "@/lib/format";
import { APPLIANCE_CATEGORY_LABELS } from "@/lib/labels";
import { Empty, ForecastBadge, PageHeader, Section } from "@/components/ui";

export default async function ForecastPage() {
  const user = await requireUser();
  const homeIds = await visibleHomeIds(user);

  const appliances = await prisma.appliance.findMany({
    where: { homeId: { in: homeIds } },
    include: { home: { select: { id: true, name: true } } },
  });

  const homeNames = new Map(appliances.map((a) => [a.home.id, a.home.name]));
  const items = buildForecast(appliances);

  const flagged = items.filter((i) => i.status !== "OK");
  const estimatedTotal = flagged.reduce(
    (sum, item) => sum + (item.estimatedCost ?? 0),
    0,
  );

  const untracked = appliances.filter(
    (a) => !a.installedOn && !a.modelYear,
  ).length;

  return (
    <>
      <PageHeader
        title="Maintenance forecast"
        subtitle="Appliance age against expected service life. Used units age from their model year. An estimate for planning, not a prediction."
      />

      <Section
        title="Coming due"
        description={
          flagged.length
            ? `${flagged.length} items · roughly ${formatDollars(estimatedTotal)} if all were replaced`
            : undefined
        }
      >
        {flagged.length === 0 ? (
          <Empty>Nothing is inside its replacement window right now.</Empty>
        ) : (
          <ForecastTable items={flagged} homeNames={homeNames} />
        )}
      </Section>

      <Section title="Everything else">
        {items.length === flagged.length ? (
          <Empty>No other items with an in-service date.</Empty>
        ) : (
          <ForecastTable
            items={items.filter((i) => i.status === "OK")}
            homeNames={homeNames}
          />
        )}
        {untracked > 0 ? (
          <p className="mt-3 text-xs text-[var(--subtle)]">
            {untracked} {untracked === 1 ? "item has" : "items have"} neither a
            model year nor an in-service date, so {untracked === 1 ? "it isn't" : "they aren't"} forecast.
          </p>
        ) : null}
      </Section>
    </>
  );
}

function ForecastTable({
  items,
  homeNames,
}: {
  items: ReturnType<typeof buildForecast>;
  homeNames: Map<string, string>;
}) {
  return (
    <div className="overflow-x-auto">
            <table className="table min-w-[36rem]">
      <thead>
        <tr>
          <th>Item</th>
          <th>Status</th>
          <th>Home</th>
          <th>In service</th>
          <th>Age</th>
          <th>Typical life</th>
          <th>Window opens</th>
          <th>Est. cost</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.applianceId}>
            <td>
              <Link
                className="font-medium text-[var(--text)] hover:underline"
                href={`/homes/${item.homeId}/appliances/${item.applianceId}`}
              >
                {item.name}
              </Link>
              <div className="text-xs text-[var(--subtle)]">
                {APPLIANCE_CATEGORY_LABELS[item.category]}
                {item.location ? ` · ${item.location}` : ""}
              </div>
            </td>
            <td>
              <ForecastBadge status={item.status} />
            </td>
            <td className="text-xs">{homeNames.get(item.homeId) ?? "—"}</td>
            <td className="whitespace-nowrap">{formatDate(item.installedOn)}</td>
            <td>{item.ageYears} yrs</td>
            <td className="whitespace-nowrap">
              {item.lifespanLow}–{item.lifespanHigh} yrs
            </td>
            <td>{item.expectedReplacementYear}</td>
            <td>{formatDollars(item.estimatedCost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
          </div>
  );
}
