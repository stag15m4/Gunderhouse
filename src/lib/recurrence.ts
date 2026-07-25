import { RecurrenceUnit } from "@prisma/client";

/**
 * Recurring-task scheduling.
 *
 * Intervals are anchored to the completion date, not to a fixed calendar grid:
 * finishing a quarterly job three weeks late pushes the next one out three
 * weeks. For household chores that's the behaviour you want — the point is the
 * gap between servicings, not hitting an arbitrary date.
 */

export type TaskStatus = "OVERDUE" | "DUE_SOON" | "UPCOMING";

/** Days out from today that still counts as "coming up". */
export const DUE_SOON_DAYS = 14;

export const RECURRENCE_UNIT_LABELS: Record<RecurrenceUnit, string> = {
  DAY: "days",
  WEEK: "weeks",
  MONTH: "months",
  YEAR: "years",
};

/** Add one interval to a date, in UTC, keeping calendar months intact. */
export function addInterval(
  from: Date,
  value: number,
  unit: RecurrenceUnit,
): Date {
  const next = new Date(from.getTime());
  switch (unit) {
    case "DAY":
      next.setUTCDate(next.getUTCDate() + value);
      break;
    case "WEEK":
      next.setUTCDate(next.getUTCDate() + value * 7);
      break;
    case "MONTH":
      next.setUTCMonth(next.getUTCMonth() + value);
      break;
    case "YEAR":
      next.setUTCFullYear(next.getUTCFullYear() + value);
      break;
  }
  return next;
}

/** "every 3 months", "yearly", "every 10 days" */
export function describeInterval(
  value: number,
  unit: RecurrenceUnit,
): string {
  if (value === 1) {
    return { DAY: "daily", WEEK: "weekly", MONTH: "monthly", YEAR: "yearly" }[
      unit
    ];
  }
  return `every ${value} ${RECURRENCE_UNIT_LABELS[unit]}`;
}

/** Whole days from today until the due date; negative once overdue. */
export function daysUntil(due: Date, now: Date = new Date()): number {
  const startOfToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const dueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );
  return Math.round((dueDay - startOfToday) / 86_400_000);
}

export function taskStatus(due: Date, now: Date = new Date()): TaskStatus {
  const days = daysUntil(due, now);
  if (days < 0) return "OVERDUE";
  if (days <= DUE_SOON_DAYS) return "DUE_SOON";
  return "UPCOMING";
}

export type TaskView = {
  id: string;
  homeId: string;
  title: string;
  applianceId: string | null;
  applianceName: string | null;
  intervalValue: number;
  intervalUnit: RecurrenceUnit;
  cadence: string;
  nextDueOn: Date;
  lastCompletedOn: Date | null;
  daysUntilDue: number;
  status: TaskStatus;
  active: boolean;
  notes: string | null;
};

const STATUS_ORDER: Record<TaskStatus, number> = {
  OVERDUE: 0,
  DUE_SOON: 1,
  UPCOMING: 2,
};

export function toTaskView(
  task: {
    id: string;
    homeId: string;
    title: string;
    applianceId: string | null;
    intervalValue: number;
    intervalUnit: RecurrenceUnit;
    nextDueOn: Date;
    lastCompletedOn: Date | null;
    active: boolean;
    notes: string | null;
    appliance?: { name: string } | null;
  },
  now: Date = new Date(),
): TaskView {
  return {
    id: task.id,
    homeId: task.homeId,
    title: task.title,
    applianceId: task.applianceId,
    applianceName: task.appliance?.name ?? null,
    intervalValue: task.intervalValue,
    intervalUnit: task.intervalUnit,
    cadence: describeInterval(task.intervalValue, task.intervalUnit),
    nextDueOn: task.nextDueOn,
    lastCompletedOn: task.lastCompletedOn,
    daysUntilDue: daysUntil(task.nextDueOn, now),
    // A paused task is never "due" — it just sits there until reactivated.
    status: task.active ? taskStatus(task.nextDueOn, now) : "UPCOMING",
    active: task.active,
    notes: task.notes,
  };
}

/** Most urgent first; paused tasks sink to the bottom. */
export function sortTasks(tasks: TaskView[]): TaskView[] {
  return [...tasks].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.nextDueOn.getTime() - b.nextDueOn.getTime(),
  );
}
