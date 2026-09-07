import { NextResponse } from "next/server";
import { checkLegalToken } from "@/lib/legal";
import { isoDate } from "@/lib/alfred";
import { prisma } from "@/lib/prisma";
import { buildEquity } from "@/lib/equity";
import { formatAddress } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The list Legal needs to attach a matter to a property. Address is included
 * because that's how a legal file identifies real estate — a recorded deed
 * carries a legal description and a street address, not a cuid.
 */
export async function GET(request: Request) {
  const denied = checkLegalToken(request);
  if (denied) return denied;

  const homes = await prisma.home.findMany({
    orderBy: { name: "asc" },
    include: { valuations: true, liens: true },
  });

  return NextResponse.json({
    properties: homes.map((home) => {
      const equity = buildEquity({ home, valuations: home.valuations, liens: home.liens });
      return {
        propertyId: home.id,
        name: home.name,
        type: home.type,
        address: {
          line1: home.addressLine1,
          line2: home.addressLine2,
          city: home.city,
          state: home.state,
          postalCode: home.postalCode,
          formatted: formatAddress(home) || null,
        },
        purchasedOn: isoDate(home.purchasedOn),
        currentValueUsd: equity.basis ? equity.valueCents / 100 : null,
        valuedOn: isoDate(equity.basis?.valuedOn ?? null),
        valuationSource: equity.basis?.source ?? null,
        totalOwedUsd: equity.totalOwedCents / 100,
        grossEquityUsd: equity.basis ? equity.grossEquityCents / 100 : null,
      };
    }),
  });
}
