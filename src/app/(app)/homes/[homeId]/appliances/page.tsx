import Link from "next/link";
import { canEdit, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { forecastAppliance } from "@/lib/forecast";
import { formatDate } from "@/lib/format";
import { APPLIANCE_CATEGORY_LABELS } from "@/lib/labels";
import { Empty, ForecastBadge, PageHeader } from "@/components/ui";

export default async function AppliancesPage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const { home, role } = await requireHome(homeId);

  const appliances = await prisma.appliance.findMany({
    where: { homeId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Appliances & systems"
        subtitle={home.name}
        backHref={`/homes/${homeId}`}
        backLabel={home.name}
        actions={
          canEdit(role) ? (
            <Link className="btn" href={`/homes/${homeId}/appliances/new`}>
              Add appliance
            </Link>
          ) : null
        }
      />

      <div className="card p-4">
        {appliances.length === 0 ? (
          <Empty>
            Nothing tracked yet. Roof, HVAC, and other whole-home systems belong
            here too.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[36rem]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Location</th>
                <th>In service</th>
                <th>Warranty</th>
                <th>Forecast</th>
              </tr>
            </thead>
            <tbody>
              {appliances.map((appliance) => {
                const forecast = forecastAppliance(appliance);
                return (
                  <tr key={appliance.id}>
                    <td>
                      <Link
                        className="font-medium text-[var(--text)] hover:underline"
                        href={`/homes/${homeId}/appliances/${appliance.id}`}
                      >
                        {appliance.name}
                      </Link>
                      {appliance.brand ? (
                        <div className="text-xs text-[var(--subtle)]">
                          {appliance.brand}
                          {appliance.modelNumber
                            ? ` · ${appliance.modelNumber}`
                            : ""}
                        </div>
                      ) : null}
                    </td>
                    <td>{APPLIANCE_CATEGORY_LABELS[appliance.category]}</td>
                    <td>{appliance.location ?? "—"}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(appliance.installedOn)}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatDate(appliance.warrantyExpiresOn)}
                    </td>
                    <td>
                      {forecast ? (
                        <ForecastBadge status={forecast.status} />
                      ) : (
                        <span className="text-xs text-[var(--faint)]">
                          No in-service date
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}
