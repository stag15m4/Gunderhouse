import Link from "next/link";
import type { Project } from "@prisma/client";
import { PROJECT_TIMING_LABELS, projectTiming } from "@/lib/projects";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Badge,
  Empty,
  Field,
  SelectField,
  TextareaField,
} from "@/components/ui";

/**
 * The house to-do list, shared by the forecast (across every home) and a
 * single home's page. Pass `homeNames` only where the home isn't already
 * obvious from context.
 */
export function ProjectList({
  projects,
  homeNames,
  editableHomeIds,
  returnTo,
  empty = "Nothing planned yet.",
}: {
  projects: Project[];
  homeNames?: Map<string, string>;
  editableHomeIds: Set<string>;
  /** Where the project page should send you back to. */
  returnTo: string;
  empty?: string;
}) {
  if (projects.length === 0) return <Empty>{empty}</Empty>;

  return (
    <ul className="divide-y divide-[var(--border)]">
      {projects.map((project) => {
        const timing = projectTiming(project);
        const home = homeNames?.get(project.homeId);
        return (
          <li
            key={project.id}
            className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[var(--text)]">
                {project.title}
              </div>
              <div className="mt-0.5 text-xs text-[var(--subtle)]">
                {home ? `${home} · ` : ""}
                {project.targetOn
                  ? `target ${formatDate(project.targetOn)}`
                  : "no target date"}
              </div>
              <div className="mt-2">
                <Badge tone={timing === "OVERDUE" ? "amber" : "neutral"}>
                  {PROJECT_TIMING_LABELS[timing]}
                </Badge>
              </div>
              {project.notes ? (
                <div className="mt-1.5 text-xs text-[var(--subtle)]">
                  {project.notes}
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {project.estimatedCostCents !== null ? (
                <div className="text-base font-medium text-[var(--text)]">
                  {formatMoney(project.estimatedCostCents)}
                </div>
              ) : (
                <div className="text-xs text-[var(--faint)]">
                  Not priced yet
                </div>
              )}
              <Link
                className="text-xs text-[var(--subtle)] transition-colors hover:text-[var(--text)]"
                href={`/projects/${project.id}?from=${encodeURIComponent(returnTo)}`}
              >
                {editableHomeIds.has(project.homeId) ? "Edit" : "View"}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The add form. Takes the homes the person can actually add to; when there's
 * only one there's nothing to choose, so the selector is a hidden field.
 */
export function AddProjectForm({
  action,
  homes,
  returnTo,
}: {
  action: (form: FormData) => void | Promise<void>;
  homes: { id: string; name: string }[];
  returnTo: string;
}) {
  if (homes.length === 0) return null;

  return (
    <details className="mt-4 border-t border-[var(--border-soft)] pt-4">
      <summary className="cursor-pointer text-sm font-medium text-[var(--muted)]">
        Add a project
      </summary>
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Project"
            name="title"
            required
            placeholder="New kitchen floor"
          />
          {homes.length === 1 ? (
            <input type="hidden" name="homeId" value={homes[0].id} />
          ) : (
            <SelectField
              label="Home"
              name="homeId"
              options={homes.map((h) => ({ value: h.id, label: h.name }))}
            />
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Estimated cost"
            name="estimatedCost"
            placeholder="3000"
            hint="Optional. Leave blank until you've priced it."
          />
          <Field
            label="Target date"
            name="targetOn"
            type="date"
            hint="Optional. Leave blank for someday."
          />
        </div>
        <TextareaField label="Notes" name="notes" rows={2} />
        <button className="btn" type="submit">
          Add project
        </button>
      </form>
    </details>
  );
}
