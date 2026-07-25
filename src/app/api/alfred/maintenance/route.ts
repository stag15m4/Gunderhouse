import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  checkAlfredToken,
  dateParam,
  isoDate,
  notFound,
  resolveHome,
} from "@/lib/alfred";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function GET(request: Request) {
  const denied = checkAlfredToken(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const home = await resolveHome(url);
  if (home === "not_found") return notFound("No home matches that identifier.");

  const from = dateParam(url, "from");
  const to = dateParam(url, "to");
  const applianceId = url.searchParams.get("applianceId");

  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const where: Prisma.MaintenanceEntryWhereInput = {
    ...(home ? { homeId: home.id } : {}),
    ...(applianceId ? { applianceId } : {}),
    ...(from || to
      ? {
          performedOn: {
            ...(from ? { gte: from } : {}),
            // `to` is inclusive: shift to the start of the next day.
            ...(to ? { lt: new Date(to.getTime() + 86_400_000) } : {}),
          },
        }
      : {}),
  };

  const [entries, totals] = await Promise.all([
    prisma.maintenanceEntry.findMany({
      where,
      orderBy: { performedOn: "desc" },
      take: limit,
      include: {
        home: { select: { id: true, name: true } },
        appliance: { select: { id: true, name: true, category: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.maintenanceEntry.aggregate({
      where,
      _sum: { costCents: true },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    home: home ?? null,
    range: { from: isoDate(from), to: isoDate(to) },
    totals: {
      entries: totals._count._all,
      costUsd: (totals._sum.costCents ?? 0) / 100,
    },
    returned: entries.length,
    entries: entries.map((entry) => ({
      id: entry.id,
      homeId: entry.homeId,
      homeName: entry.home.name,
      performedOn: isoDate(entry.performedOn),
      description: entry.description,
      costUsd: entry.costCents === null ? null : entry.costCents / 100,
      vendor: entry.vendor,
      notes: entry.notes,
      appliance: entry.appliance
        ? {
            id: entry.appliance.id,
            name: entry.appliance.name,
            category: entry.appliance.category,
          }
        : null,
      loggedBy: entry.createdBy?.name ?? null,
    })),
  });
}
