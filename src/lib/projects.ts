import type { Project } from "@prisma/client";

export type ProjectTiming = "OVERDUE" | "THIS_YEAR" | "LATER" | "UNDATED";

/**
 * Where a planned project sits relative to now. Purely for grouping and
 * ordering — a project has no expected-life calculation behind it the way an
 * appliance does; it happens when you decide it happens.
 */
export function projectTiming(
  project: Pick<Project, "targetOn">,
  now: Date = new Date(),
): ProjectTiming {
  if (!project.targetOn) return "UNDATED";
  if (project.targetOn < now) return "OVERDUE";
  return project.targetOn.getUTCFullYear() === now.getUTCFullYear()
    ? "THIS_YEAR"
    : "LATER";
}

const ORDER: Record<ProjectTiming, number> = {
  OVERDUE: 0,
  THIS_YEAR: 1,
  LATER: 2,
  UNDATED: 3,
};

/** Soonest first; undated projects sink to the bottom. */
export function sortProjects<T extends Pick<Project, "targetOn" | "title">>(
  projects: T[],
  now: Date = new Date(),
): T[] {
  return [...projects].sort((a, b) => {
    const byTiming = ORDER[projectTiming(a, now)] - ORDER[projectTiming(b, now)];
    if (byTiming !== 0) return byTiming;
    if (a.targetOn && b.targetOn) {
      return a.targetOn.getTime() - b.targetOn.getTime();
    }
    return a.title.localeCompare(b.title);
  });
}

export const PROJECT_TIMING_LABELS: Record<ProjectTiming, string> = {
  OVERDUE: "Past target",
  THIS_YEAR: "This year",
  LATER: "Later",
  UNDATED: "No date",
};
