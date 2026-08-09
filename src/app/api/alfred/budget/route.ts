import { NextResponse } from "next/server";
import { BudgetKind } from "@prisma/client";
import { checkAlfredToken, notFound, resolveHome } from "@/lib/alfred";
import { prisma } from "@/lib/prisma";
import {
  buildCategoryLine,
  buildHomeMonth,
  monthEnd,
  monthKey,
  monthLabel,
  linesForMonth,
  monthStart,
  parseMonth,
  projectsCompletedIn,
  sortCategories,
  summarise,
} from "@/lib/budget";

export const dynamic = "force-dynamic";

const usd = (cents: number) => Math.round(cents) / 100;

export async function GET(request: Request) {
  const denied = checkAlfredToken(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const home = await resolveHome(url);
  if (home === "not_found") return notFound("No home matches that identifier.");

  const month = parseMonth(url.searchParams.get("month") ?? undefined);
  const start = monthStart(month);
  const end = monthEnd(month);

  const [categories, entries, maintenance, projects, appliances, homes] =
    await Promise.all([
      // Only what the household has marked readable by the assistant. This
      // surface has no user identity behind it — it holds a shared token — so
      // a category opted out here is invisible regardless of who is asking.
      prisma.budgetCategory.findMany({
        where: { assistantAccess: true },
        include: { recurring: true },
      }),
      prisma.budgetEntry.findMany({
        where: {
          occurredOn: { gte: start, lt: end },
          category: { assistantAccess: true },
        },
      }),
      prisma.maintenanceEntry.findMany({
        where: {
          ...(home ? { homeId: home.id } : {}),
          performedOn: { gte: start, lt: end },
        },
      }),
      prisma.project.findMany({ where: home ? { homeId: home.id } : {} }),
      prisma.appliance.findMany({ where: home ? { homeId: home.id } : {} }),
      prisma.home.findMany({
        where: home ? { id: home.id } : {},
        select: { id: true, name: true, monthlyBudgetCents: true },
      }),
    ]);

  const lines = linesForMonth(
    sortCategories(categories).map((category) =>
      buildCategoryLine(
        category,
        entries.filter((e) => e.categoryId === category.id),
        month,
      ),
    ),
  );

  const homeMonths = homes.map((h) =>
    buildHomeMonth({
      home: h,
      maintenance: maintenance.filter((e) => e.homeId === h.id),
      projects: projectsCompletedIn(
        projects.filter((p) => p.homeId === h.id),
        month,
      ),
      categoryLines: lines,
      appliances: appliances.filter((a) => a.homeId === h.id),
    }),
  );

  const totals = summarise(lines, homeMonths);

  return NextResponse.json({
    home: home ?? null,
    month: monthKey(month),
    monthLabel: monthLabel(month),
    // Flagged so a caller can say the totals are partial rather than quoting
    // them as the whole picture.
    withheldCategories: await prisma.budgetCategory.count({
      where: { assistantAccess: false, archived: false },
    }),
    basis:
      "Every amount is a monthly figure. Recurring charges are smoothed to a " +
      "monthly equivalent rather than landing in the month they're billed, so " +
      "an annual premium shows as one twelfth each month. A single month here " +
      "will not match a single bank statement; it answers what the household " +
      "needs per month, which is the planning question.",
    totals: {
      incomeUsd: usd(totals.incomeCents),
      expenseUsd: usd(totals.expenseCents),
      netUsd: usd(totals.netCents),
      plannedIncomeUsd: usd(totals.plannedIncomeCents),
      plannedExpenseUsd: usd(totals.plannedExpenseCents),
      plannedNetUsd: usd(totals.plannedNetCents),
      // What the houses accrue monthly toward eventual replacement. Saving,
      // not spending — deliberately excluded from expenses above.
      homeReserveUsd: usd(homeMonths.reduce((s, h) => s + h.reserveCents, 0)),
    },
    categories: lines
      .filter((line) => line.category.homeId === null)
      .map((line) => ({
        id: line.category.id,
        name: line.category.name,
        kind: line.category.kind,
        // null when the category has no target — it's tracked, not judged.
        monthlyTargetUsd:
          line.category.monthlyTargetCents === null
            ? null
            : usd(line.category.monthlyTargetCents),
        committedUsd: usd(line.committedCents),
        loggedUsd: usd(line.loggedCents),
        actualUsd: usd(line.actualCents),
        varianceUsd:
          line.varianceCents === null ? null : usd(line.varianceCents),
        recurring: line.items.map((i) => ({
          id: i.id,
          label: i.label,
          amountUsd: usd(i.amountCents),
          cadence: i.cadence,
        })),
      })),
    homes: homeMonths.map((h) => ({
      homeId: h.homeId,
      homeName: h.homeName,
      maintenanceUsd: usd(h.maintenanceCents),
      projectsUsd: usd(h.projectCents),
      otherUsd: usd(h.categoryCents),
      totalUsd: usd(h.totalCents),
      monthlyBudgetUsd: h.budgetCents === null ? null : usd(h.budgetCents),
      varianceUsd: h.varianceCents === null ? null : usd(h.varianceCents),
      recommendedReserveUsd: usd(h.reserveCents),
    })),
    incomeCategories: lines.filter(
      (l) => l.category.kind === BudgetKind.INCOME,
    ).length,
  });
}
