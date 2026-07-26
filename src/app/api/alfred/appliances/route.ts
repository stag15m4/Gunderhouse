import { NextResponse } from "next/server";
import { ApplianceCategory, type Prisma } from "@prisma/client";
import { checkAlfredToken, isoDate, notFound, resolveHome } from "@/lib/alfred";
import { prisma } from "@/lib/prisma";
import { lifespanFor } from "@/lib/lifespans";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = checkAlfredToken(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const home = await resolveHome(url);
  if (home === "not_found") return notFound("No home matches that identifier.");

  const categoryParam = url.searchParams.get("category");
  const category =
    categoryParam && categoryParam in ApplianceCategory
      ? (categoryParam as ApplianceCategory)
      : null;

  const where: Prisma.ApplianceWhereInput = {
    ...(home ? { homeId: home.id } : {}),
    ...(category ? { category } : {}),
  };

  const appliances = await prisma.appliance.findMany({
    where,
    orderBy: [{ installedOn: "desc" }, { name: "asc" }],
    include: { home: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    home: home ?? null,
    appliances: appliances.map((appliance) => {
      const lifespan = lifespanFor(appliance.category);
      return {
        id: appliance.id,
        homeId: appliance.homeId,
        homeName: appliance.home.name,
        name: appliance.name,
        category: appliance.category,
        brand: appliance.brand,
        modelNumber: appliance.modelNumber,
        serialNumber: appliance.serialNumber,
        location: appliance.location,
        installedOn: isoDate(appliance.installedOn),
        // Set when the unit predates its arrival here — i.e. bought used.
        modelYear: appliance.modelYear,
        warrantyExpiresOn: isoDate(appliance.warrantyExpiresOn),
        expectedLifespanYears: {
          low: appliance.expectedLifeLowYears ?? lifespan.low,
          high: appliance.expectedLifeHighYears ?? lifespan.high,
          // false when it came from the category table, true when set by hand.
          overridden:
            appliance.expectedLifeLowYears !== null ||
            appliance.expectedLifeHighYears !== null,
        },
        notes: appliance.notes,
      };
    }),
  });
}
