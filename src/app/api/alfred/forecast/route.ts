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
      "Age compared to an expected service-life range. Age runs from the unit's " +
      "model year when one is recorded (a second-hand machine is as old as it " +
      "is), otherwise from its in-service date. The range is the category " +
      "default unless overridden for that unit.",
    totals: {
      items: items.length,
      estimatedReplacementCostUsd: estimatedTotal,
      applianceCountNotForecast: appliances.filter(
        (a) => !a.installedOn && !a.modelYear,
      ).length,
    },
    items: items.map((item) => ({
      applianceId: item.applianceId,
      homeId: item.homeId,
      homeName: homeNames.get(item.homeId) ?? null,
      name: item.name,
      category: item.category,
      location: item.location,
      installedOn: isoDate(item.installedOn),
      modelYear: item.modelYear,
      // MODEL_YEAR for a used unit, IN_SERVICE otherwise — so a caller can say
      // why something reads older than the date it was installed.
      ageBasis: item.ageBasis,
      agedFrom: isoDate(item.agedFrom),
      ageYears: item.ageYears,
      expectedLifespanYears: {
        low: item.lifespanLow,
        high: item.lifespanHigh,
        overridden: item.lifespanOverridden,
      },
      replacementWindowOpensYear: item.expectedReplacementYear,
      yearsRemaining: item.yearsRemaining,
      status: item.status,
      estimatedReplacementCostUsd: item.estimatedCost,
      warrantyExpiresOn: isoDate(item.warrantyExpiresOn),
    })),
  });
}
