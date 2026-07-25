import { NextResponse } from "next/server";
import { checkAlfredToken, isoDate, notFound, resolveHome } from "@/lib/alfred";
import { prisma } from "@/lib/prisma";
import { buildForecast, upcomingOnly } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = checkAlfredToken(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const home = await resolveHome(url);
  if (home === "not_found") return notFound("No home matches that identifier.");

  const includeOk = url.searchParams.get("includeOk") === "1";

  const appliances = await prisma.appliance.findMany({
    where: home ? { homeId: home.id } : {},
    include: { home: { select: { id: true, name: true } } },
  });

  const homeNames = new Map(appliances.map((a) => [a.home.id, a.home.name]));
  const all = buildForecast(appliances);
  const items = includeOk ? all : upcomingOnly(all);

  const estimatedTotal = items.reduce(
    (sum, item) => sum + (item.estimatedCost ?? 0),
    0,
  );

  return NextResponse.json({
    home: home ?? null,
    generatedAt: new Date().toISOString(),
    basis:
      "Age since in-service date compared to a typical service-life range per category.",
    totals: {
      items: items.length,
      estimatedReplacementCostUsd: estimatedTotal,
      applianceCountWithoutInstallDate: appliances.filter((a) => !a.installedOn)
        .length,
    },
    items: items.map((item) => ({
      applianceId: item.applianceId,
      homeId: item.homeId,
      homeName: homeNames.get(item.homeId) ?? null,
      name: item.name,
      category: item.category,
      location: item.location,
      installedOn: isoDate(item.installedOn),
      ageYears: item.ageYears,
      expectedLifespanYears: { low: item.lifespanLow, high: item.lifespanHigh },
      replacementWindowOpensYear: item.expectedReplacementYear,
      yearsRemaining: item.yearsRemaining,
      status: item.status,
      estimatedReplacementCostUsd: item.estimatedCost,
      warrantyExpiresOn: isoDate(item.warrantyExpiresOn),
    })),
  });
}
