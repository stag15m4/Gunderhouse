import { NextResponse } from "next/server";
import { checkAlfredToken, isoDate, notFound, resolveHome } from "@/lib/alfred";
import { prisma } from "@/lib/prisma";
import { sortTasks, toTaskView } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

/**
 * Routine maintenance tasks and when they're next due.
 *
 * `status=due` (the default) returns only what's overdue or coming up, so
 * "what's due at the lake house?" is one call with no filtering on the
 * assistant's side. `status=all` includes everything, paused tasks included.
 */
export async function GET(request: Request) {
  const denied = checkAlfredToken(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const home = await resolveHome(url);
  if (home === "not_found") return notFound("No home matches that identifier.");

  const status = url.searchParams.get("status") ?? "due";
  const includeEverything = status === "all";

  const rows = await prisma.maintenanceTask.findMany({
    where: {
      ...(home ? { homeId: home.id } : {}),
      ...(includeEverything ? {} : { active: true }),
    },
    include: {
      appliance: { select: { id: true, name: true } },
      home: { select: { id: true, name: true } },
    },
  });

  const homeNames = new Map(rows.map((t) => [t.homeId, t.home.name]));
  const all = sortTasks(rows.map((task) => toTaskView(task)));
  const tasks = includeEverything
    ? all
    : all.filter((t) => t.status !== "UPCOMING");

  return NextResponse.json({
    home: home ?? null,
    generatedAt: new Date().toISOString(),
    filter: includeEverything ? "all" : "due",
    totals: {
      returned: tasks.length,
      overdue: tasks.filter((t) => t.status === "OVERDUE").length,
      dueSoon: tasks.filter((t) => t.status === "DUE_SOON").length,
    },
    tasks: tasks.map((task) => ({
      id: task.id,
      homeId: task.homeId,
      homeName: homeNames.get(task.homeId) ?? null,
      title: task.title,
      cadence: task.cadence,
      intervalValue: task.intervalValue,
      intervalUnit: task.intervalUnit,
      appliance: task.applianceId
        ? { id: task.applianceId, name: task.applianceName }
        : null,
      nextDueOn: isoDate(task.nextDueOn),
      lastCompletedOn: isoDate(task.lastCompletedOn),
      daysUntilDue: task.daysUntilDue,
      status: task.status,
      active: task.active,
      notes: task.notes,
    })),
  });
}
