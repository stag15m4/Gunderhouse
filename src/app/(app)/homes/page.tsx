import Link from "next/link";
import { requireUser, visibleHomes } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { buildForecast, upcomingOnly } from "@/lib/forecast";
import { formatAddress } from "@/lib/format";
import { HOME_ROLE_SHORT, HOME_TYPE_LABELS } from "@/lib/labels";
import { Badge, Empty, PageHeader } from "@/components/ui";

export default async function HomesPage() {
  const user = await requireUser();
  const homes = await visibleHomes(user);

  const counts = await prisma.appliance.groupBy({
    by: ["homeId"],
    where: { homeId: { in: homes.map((h) => h.id) } },
    _count: { _all: true },
  });
  const applianceCount = new Map(counts.map((c) => [c.homeId, c._count._all]));

  const appliances = await prisma.appliance.findMany({
    where: { homeId: { in: homes.map((h) => h.id) } },
    select: {
      id: true,
      homeId: true,
      name: true,
      category: true,
      location: true,
      installedOn: true,
      warrantyExpiresOn: true,
    },
  });
  const upcoming = upcomingOnly(buildForecast(appliances));
  const upcomingByHome = new Map<string, number>();
  for (const item of upcoming) {
    upcomingByHome.set(item.homeId, (upcomingByHome.get(item.homeId) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Homes"
        subtitle={`${homes.length} ${homes.length === 1 ? "home" : "homes"}`}
        actions={
          user.systemRole === "OWNER" ? (
            <Link className="btn" href="/homes/new">
              Add home
            </Link>
          ) : null
        }
      />

      {homes.length === 0 ? (
        <div className="card p-6">
          <Empty>
            {user.systemRole === "OWNER"
              ? "No homes yet. Add your first one to get started."
              : "You haven't been given access to any homes yet."}
          </Empty>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {homes.map((home) => {
            const flagged = upcomingByHome.get(home.id) ?? 0;
            const address = formatAddress(home);
            return (
              <Link
                key={home.id}
                href={`/homes/${home.id}`}
                className="card block p-4 transition hover:border-stone-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium text-stone-900">{home.name}</h2>
                  <Badge tone={home.type === "RENTAL" ? "blue" : "neutral"}>
                    {HOME_TYPE_LABELS[home.type]}
                  </Badge>
                </div>
                {address ? (
                  <p className="mt-1 text-sm text-stone-500">{address}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                  <span>
                    {applianceCount.get(home.id) ?? 0} appliances &amp; systems
                  </span>
                  {flagged > 0 ? (
                    <Badge tone="amber">{flagged} coming due</Badge>
                  ) : null}
                  <span className="ml-auto">
                    Your access: {HOME_ROLE_SHORT[home.role]}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
