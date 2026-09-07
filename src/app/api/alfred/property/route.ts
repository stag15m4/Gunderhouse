import { NextResponse } from "next/server";
import { HomeType } from "@prisma/client";
import { checkAlfredToken, isoDate, notFound, resolveHome } from "@/lib/alfred";
import { prisma } from "@/lib/prisma";
import { buildEquity } from "@/lib/equity";
import { buildRent, maintenanceRunRate } from "@/lib/rental";
import { buildCategoryLine, monthlyReserveCents } from "@/lib/budget";

export const dynamic = "force-dynamic";

const usd = (cents: number) => Math.round(cents) / 100;

/** What each property is worth, what's owed, and what a rental has to earn. */
export async function GET(request: Request) {
  const denied = checkAlfredToken(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const home = await resolveHome(url);
  if (home === "not_found") return notFound("No home matches that identifier.");

  const homes = await prisma.home.findMany({
    where: home ? { id: home.id } : {},
    orderBy: { name: "asc" },
    include: {
      valuations: true,
      liens: true,
      appliances: true,
      maintenance: true,
      // Same assistant switch the budget uses: a category held back from the
      // assistant stays out of the carrying costs here too.
      budgetCategories: {
        where: { archived: false, assistantAccess: true },
        include: { recurring: true },
      },
    },
  });

  const now = new Date();
  const month = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };

  return NextResponse.json({
    generatedAt: now.toISOString(),
    basis:
      "Equity rests on the most recent valuation; when 'unvalued' is true " +
      "there isn't one and the figures are meaningless rather than zero. " +
      "'availableTodayUsd' is undrawn credit, spendable now. " +
      "'borrowingHeadroomUsd' needs a new loan. They are different kinds of " +
      "money and must not be added together.",
    properties: homes.map((h) => {
      const equity = buildEquity({ home: h, valuations: h.valuations, liens: h.liens });
      const carrying = h.budgetCategories.reduce(
        (sum, c) => sum + buildCategoryLine(c, [], month).actualCents,
        0,
      );
      const rent = buildRent({
        home: h,
        liens: h.liens,
        carryingCostCents: carrying,
        reserveCents: monthlyReserveCents(h.appliances),
        maintenanceRunRateCents: maintenanceRunRate(h.maintenance, 12, now),
      });

      return {
        homeId: h.id,
        homeName: h.name,
        type: h.type,
        value: {
          currentUsd: equity.basis ? usd(equity.valueCents) : null,
          valuedOn: isoDate(equity.basis?.valuedOn ?? null),
          source: equity.basis?.source ?? null,
          unvalued: equity.unvalued,
        },
        owedUsd: usd(equity.totalOwedCents),
        grossEquityUsd: equity.basis ? usd(equity.grossEquityCents) : null,
        ltvPercent: equity.ltvBps === null ? null : equity.ltvBps / 100,
        availableTodayUsd: usd(equity.undrawnCreditCents),
        borrowingHeadroomUsd: usd(equity.borrowingHeadroomCents),
        liens: equity.liens
          .filter((l) => l.closedOn === null)
          .map((l) => ({
            type: l.type,
            lender: l.lender,
            balanceUsd: usd(l.currentBalanceCents),
            monthlyPaymentUsd:
              l.monthlyPaymentCents === null ? null : usd(l.monthlyPaymentCents),
            source: l.source,
          })),
        // Only meaningful for a rental; null elsewhere so a caller doesn't
        // quote a break-even rent for someone's own house.
        rental:
          h.type === HomeType.RENTAL
            ? {
                monthlyRentUsd:
                  rent.rentCents === null ? null : usd(rent.rentCents),
                breakEvenRentUsd:
                  rent.breakEvenRentCents === null
                    ? null
                    : usd(rent.breakEvenRentCents),
                monthlyCashFlowUsd:
                  rent.monthlyCashFlowCents === null
                    ? null
                    : usd(rent.monthlyCashFlowCents),
                fixedCostsUsd: usd(rent.fixedCostCents),
                costBreakdown: {
                  debtServiceUsd: usd(rent.debtServiceCents),
                  carryingUsd: usd(rent.carryingCostCents),
                  reserveUsd: usd(rent.reserveCents),
                  upkeepRunRateUsd: usd(rent.maintenanceRunRateCents),
                },
                vacancyPercent: rent.vacancyRateBps / 100,
                managementPercent: rent.managementFeeBps / 100,
              }
            : null,
      };
    }),
  });
}
