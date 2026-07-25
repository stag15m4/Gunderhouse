import { LogSource, type MaintenanceTask, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addInterval } from "@/lib/recurrence";

export type CompletionInput = {
  completedOn: Date;
  notes?: string | null;
  costCents?: number | null;
  vendor?: string | null;
  /** Who did it, when the completion came from a signed-in person. */
  createdById?: string | null;
  loggedVia?: LogSource;
};

/**
 * Mark a routine task done.
 *
 * One transaction does both halves: it writes the completion into the home's
 * maintenance log and rolls the schedule forward. The UI and the Alfred
 * endpoint both come through here, so a completion means the same thing however
 * it was triggered.
 */
export async function completeTask(
  task: MaintenanceTask,
  input: CompletionInput,
): Promise<{ entryId: string; task: MaintenanceTask }> {
  const nextDueOn = addInterval(
    input.completedOn,
    task.intervalValue,
    task.intervalUnit,
  );

  const [entry, updated] = await prisma.$transaction([
    prisma.maintenanceEntry.create({
      data: {
        homeId: task.homeId,
        applianceId: task.applianceId,
        taskId: task.id,
        performedOn: input.completedOn,
        description: task.title,
        costCents: input.costCents ?? null,
        vendor: input.vendor ?? null,
        notes: input.notes ?? null,
        createdById: input.createdById ?? null,
        loggedVia: input.loggedVia ?? LogSource.APP,
      },
    }),
    prisma.maintenanceTask.update({
      where: { id: task.id },
      data: { lastCompletedOn: input.completedOn, nextDueOn },
    }),
  ]);

  return { entryId: entry.id, task: updated };
}

export const taskWithAppliance = {
  appliance: { select: { id: true, name: true } },
} satisfies Prisma.MaintenanceTaskInclude;
