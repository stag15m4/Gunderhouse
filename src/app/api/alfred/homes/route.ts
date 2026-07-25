import { NextResponse } from "next/server";
import { checkAlfredToken, isoDate } from "@/lib/alfred";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = checkAlfredToken(request);
  if (denied) return denied;

  const homes = await prisma.home.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { appliances: true, maintenance: true, documents: true } },
    },
  });

  return NextResponse.json({
    homes: homes.map((home) => ({
      id: home.id,
      name: home.name,
      type: home.type,
      address: {
        line1: home.addressLine1,
        line2: home.addressLine2,
        city: home.city,
        state: home.state,
        postalCode: home.postalCode,
      },
      yearBuilt: home.yearBuilt,
      squareFeet: home.squareFeet,
      purchasedOn: isoDate(home.purchasedOn),
      notes: home.notes,
      counts: {
        appliances: home._count.appliances,
        maintenanceEntries: home._count.maintenance,
        documents: home._count.documents,
      },
    })),
  });
}
