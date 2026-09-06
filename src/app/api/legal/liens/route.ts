import { NextResponse } from "next/server";
import { LienSource, LienType, Prisma } from "@prisma/client";
import { badRequest, checkLegalToken, legalNotFound } from "@/lib/legal";
import { isoDate } from "@/lib/alfred";
import { prisma } from "@/lib/prisma";
import { buildEquity } from "@/lib/equity";

export const dynamic = "force-dynamic";

const usd = (cents: number) => Math.round(cents) / 100;
const cents = (dollars: number) => Math.round(dollars * 100);

async function resolveProperty(identifier: string) {
  return prisma.home.findFirst({
    where: {
      OR: [
        { id: identifier },
        { name: { equals: identifier, mode: "insensitive" } },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// GET — what's on record, and the equity it produces
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const denied = checkLegalToken(request);
  if (denied) return denied;

  const identifier = new URL(request.url).searchParams.get("property");
  let where: Prisma.HomeWhereInput = {};
  if (identifier) {
    const home = await resolveProperty(identifier);
    if (!home) return legalNotFound("No property matches that identifier.");
    where = { id: home.id };
  }

  const homes = await prisma.home.findMany({
    where,
    orderBy: { name: "asc" },
    include: { valuations: true, liens: true },
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    basis:
      "Equity is value less every open lien. 'availableTodayUsd' is undrawn " +
      "credit — spendable now. 'borrowingHeadroomUsd' is what a lender would " +
      "likely still advance up to the assumed combined LTV, which requires " +
      "originating a loan. They are different kinds of money; do not add them.",
    properties: homes.map((home) => {
      const equity = buildEquity({
        home,
        valuations: home.valuations,
        liens: home.liens,
      });
      return {
        propertyId: home.id,
        name: home.name,
        currentValueUsd: equity.basis ? usd(equity.valueCents) : null,
        // Every figure below rests on a valuation. Without one they are
        // meaningless rather than zero, so the flag matters.
        unvalued: equity.unvalued,
        totalOwedUsd: usd(equity.totalOwedCents),
        grossEquityUsd: equity.basis ? usd(equity.grossEquityCents) : null,
        ltvPercent: equity.ltvBps === null ? null : equity.ltvBps / 100,
        availableTodayUsd: usd(equity.undrawnCreditCents),
        borrowingHeadroomUsd: usd(equity.borrowingHeadroomCents),
        maxCombinedLtvPercent: equity.maxCombinedLtvBps / 100,
        liens: equity.liens.map((lien) => ({
          id: lien.id,
          externalId: lien.externalId,
          source: lien.source,
          type: lien.type,
          lender: lien.lender,
          position: lien.position,
          balanceUsd: usd(lien.currentBalanceCents),
          balanceAsOf: isoDate(lien.balanceAsOf),
          creditLimitUsd:
            lien.creditLimitCents === null ? null : usd(lien.creditLimitCents),
          interestRatePercent:
            lien.interestRateBps === null ? null : lien.interestRateBps / 100,
          monthlyPaymentUsd:
            lien.monthlyPaymentCents === null
              ? null
              : usd(lien.monthlyPaymentCents),
          openedOn: isoDate(lien.openedOn),
          maturesOn: isoDate(lien.maturesOn),
          closedOn: isoDate(lien.closedOn),
        })),
      };
    }),
  });
}

// ---------------------------------------------------------------------------
// PUT — replace the Legal-owned set for one property
// ---------------------------------------------------------------------------

type IncomingLien = {
  externalId?: unknown;
  type?: unknown;
  lender?: unknown;
  position?: unknown;
  balanceUsd?: unknown;
  balanceAsOf?: unknown;
  creditLimitUsd?: unknown;
  interestRatePercent?: unknown;
  monthlyPaymentUsd?: unknown;
  originalAmountUsd?: unknown;
  openedOn?: unknown;
  maturesOn?: unknown;
  closedOn?: unknown;
  notes?: unknown;
};

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function parseDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be YYYY-MM-DD.`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

function normalise(raw: IncomingLien, index: number) {
  const at = `liens[${index}]`;

  if (typeof raw.externalId !== "string" || raw.externalId.trim() === "") {
    throw new Error(
      `${at}.externalId is required — it's how a lien is matched on the next sync.`,
    );
  }
  if (typeof raw.lender !== "string" || raw.lender.trim() === "") {
    throw new Error(`${at}.lender is required.`);
  }
  if (!isNum(raw.balanceUsd) || raw.balanceUsd < 0) {
    throw new Error(`${at}.balanceUsd must be a number of dollars, not negative.`);
  }
  if (typeof raw.type !== "string" || !(raw.type in LienType)) {
    throw new Error(
      `${at}.type must be one of: ${Object.keys(LienType).join(", ")}.`,
    );
  }

  const creditLimitCents = isNum(raw.creditLimitUsd)
    ? cents(raw.creditLimitUsd)
    : null;
  const currentBalanceCents = cents(raw.balanceUsd);
  if (creditLimitCents !== null && creditLimitCents < currentBalanceCents) {
    throw new Error(`${at}.creditLimitUsd is below the balance drawn.`);
  }

  return {
    externalId: raw.externalId.trim(),
    type: raw.type as LienType,
    lender: raw.lender.trim(),
    position: isNum(raw.position) ? Math.trunc(raw.position) : null,
    originalAmountCents: isNum(raw.originalAmountUsd)
      ? cents(raw.originalAmountUsd)
      : null,
    currentBalanceCents,
    balanceAsOf: parseDate(raw.balanceAsOf, `${at}.balanceAsOf`),
    creditLimitCents,
    interestRateBps: isNum(raw.interestRatePercent)
      ? Math.round(raw.interestRatePercent * 100)
      : null,
    monthlyPaymentCents: isNum(raw.monthlyPaymentUsd)
      ? cents(raw.monthlyPaymentUsd)
      : null,
    openedOn: parseDate(raw.openedOn, `${at}.openedOn`),
    maturesOn: parseDate(raw.maturesOn, `${at}.maturesOn`),
    closedOn: parseDate(raw.closedOn, `${at}.closedOn`),
    notes: typeof raw.notes === "string" ? raw.notes : null,
  };
}

/**
 * Idempotent replace. Legal sends everything it holds for the property; this
 * reconciles by externalId and deletes Legal-owned rows that no longer appear
 * — which is how a released lien disappears without needing a delete call.
 *
 * Manually-entered liens are never read, written, or deleted here. That's the
 * safety property that makes an unconfirmed write acceptable: the worst a bad
 * payload can do is corrupt rows Legal already owned.
 */
export async function PUT(request: Request) {
  const denied = checkLegalToken(request);
  if (denied) return denied;

  let body: { propertyId?: unknown; liens?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be JSON.");
  }

  if (typeof body.propertyId !== "string" || body.propertyId === "") {
    return badRequest("propertyId is required.");
  }
  if (!Array.isArray(body.liens)) {
    return badRequest(
      "liens must be an array — send the complete current set, including an empty one to release everything.",
    );
  }

  const home = await resolveProperty(body.propertyId);
  if (!home) return legalNotFound("No property matches that identifier.");

  let incoming;
  try {
    incoming = (body.liens as IncomingLien[]).map(normalise);
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "Invalid lien payload.",
    );
  }

  const seen = new Set<string>();
  for (const lien of incoming) {
    if (seen.has(lien.externalId)) {
      return badRequest(
        `Duplicate externalId "${lien.externalId}" in the payload.`,
      );
    }
    seen.add(lien.externalId);
  }

  const existing = await prisma.lien.findMany({
    where: { homeId: home.id, source: LienSource.LEGAL },
    select: { id: true, externalId: true },
  });

  const now = new Date();
  const keep = new Set(incoming.map((l) => l.externalId));
  const removed = existing.filter(
    (row) => row.externalId === null || !keep.has(row.externalId),
  );

  // One transaction: a partial sync would leave the equity figure wrong in a
  // way nobody would notice.
  const [, ...written] = await prisma.$transaction([
    prisma.lien.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } }),
    ...incoming.map((lien) =>
      prisma.lien.upsert({
        where: {
          source_externalId: {
            source: LienSource.LEGAL,
            externalId: lien.externalId,
          },
        },
        create: {
          homeId: home.id,
          source: LienSource.LEGAL,
          externalUpdatedAt: now,
          ...lien,
        },
        update: {
          // homeId included: Legal may have re-attached the instrument to a
          // different property, and the lien should move with it.
          homeId: home.id,
          externalUpdatedAt: now,
          ...lien,
        },
      }),
    ),
  ]);

  const refreshed = await prisma.home.findUniqueOrThrow({
    where: { id: home.id },
    include: { valuations: true, liens: true },
  });
  const equity = buildEquity({
    home: refreshed,
    valuations: refreshed.valuations,
    liens: refreshed.liens,
  });

  return NextResponse.json({
    propertyId: home.id,
    name: home.name,
    synced: written.length,
    released: removed.length,
    equity: {
      currentValueUsd: equity.basis ? usd(equity.valueCents) : null,
      unvalued: equity.unvalued,
      totalOwedUsd: usd(equity.totalOwedCents),
      grossEquityUsd: equity.basis ? usd(equity.grossEquityCents) : null,
      availableTodayUsd: usd(equity.undrawnCreditCents),
      borrowingHeadroomUsd: usd(equity.borrowingHeadroomCents),
    },
  });
}
