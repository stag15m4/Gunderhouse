import { notFound } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import {
  canAdminister,
  canEdit,
  requireUser,
  roleForHome,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  completeProject,
  deleteProject,
  reopenProject,
  updateProject,
} from "@/app/actions/projects";
import { dateInputValue, formatDate, formatMoney } from "@/lib/format";
import {
  Field,
  FormError,
  PageHeader,
  Section,
  TextareaField,
} from "@/components/ui";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const { projectId } = await params;
  const { error, from } = await searchParams;
  const user = await requireUser();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { home: { select: { name: true } } },
  });
  if (!project) notFound();

  const role = await roleForHome(user, project.homeId);
  if (!role) notFound();

  const editable = canEdit(role);
  // Where you came from, so every button here lands you back there.
  const back = from && /^\/[A-Za-z0-9/_-]*$/.test(from) ? from : "/forecast";
  const backLabel = back === "/forecast" ? "Forecast" : project.home.name;
  const update = updateProject.bind(null, projectId);
  const complete = completeProject.bind(null, projectId);
  const reopen = reopenProject.bind(null, projectId);
  const remove = deleteProject.bind(null, projectId);
  const isDone = project.status === ProjectStatus.DONE;

  return (
    <>
      <PageHeader
        title={project.title}
        subtitle={`${project.home.name} · ${isDone ? "completed" : "planned"}`}
        backHref={back}
        backLabel={backLabel}
      />

      <FormError message={error} />

      {editable ? (
        <Section title="Details">
          <form action={update} className="space-y-4">
            <input type="hidden" name="returnTo" value={back} />
            <Field label="Project" name="title" required defaultValue={project.title} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Estimated cost"
                name="estimatedCost"
                defaultValue={
                  project.estimatedCostCents !== null
                    ? (project.estimatedCostCents / 100).toFixed(2)
                    : ""
                }
                hint="Optional. Leave blank until you've priced it."
              />
              <Field
                label="Target date"
                name="targetOn"
                type="date"
                defaultValue={dateInputValue(project.targetOn)}
              />
            </div>
            <TextareaField
              label="Notes"
              name="notes"
              rows={3}
              defaultValue={project.notes}
            />
            <button className="btn" type="submit">
              Save changes
            </button>
          </form>
        </Section>
      ) : (
        <Section title="Details">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--subtle)]">
                Estimated cost
              </dt>
              <dd className="text-[var(--text)]">
                {formatMoney(project.estimatedCostCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--subtle)]">
                Target
              </dt>
              <dd className="text-[var(--text)]">
                {formatDate(project.targetOn)}
              </dd>
            </div>
          </dl>
          {project.notes ? (
            <p className="mt-4 whitespace-pre-wrap text-sm text-[var(--muted)]">
              {project.notes}
            </p>
          ) : null}
        </Section>
      )}

      {editable && !isDone ? (
        <Section
          title="Mark it done"
          description="Drops it out of the forecast. The estimate is kept, so you can see how close it was."
        >
          <form action={complete} className="space-y-4">
            <input type="hidden" name="returnTo" value={back} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Completed on" name="completedOn" type="date" />
              <Field
                label="Actual cost"
                name="actualCost"
                placeholder="leave blank if not known yet"
              />
            </div>
            <button className="btn" type="submit">
              Mark done
            </button>
          </form>
        </Section>
      ) : null}

      {isDone ? (
        <Section title="Completed">
          <p className="text-sm text-[var(--muted)]">
            Finished {formatDate(project.completedOn)} ·{" "}
            {project.actualCostCents !== null
              ? `cost ${formatMoney(project.actualCostCents)}`
              : "actual cost not recorded"}{" "}
            · estimated {formatMoney(project.estimatedCostCents)}
          </p>
          {editable ? (
            <form action={reopen} className="mt-3">
              <input type="hidden" name="returnTo" value={back} />
              <button className="btn-secondary" type="submit">
                Move back to planned
              </button>
            </form>
          ) : null}
        </Section>
      ) : null}

      {canAdminister(role) ? (
        <Section title="Delete" description="Removes the project entirely.">
          <form action={remove}>
            <input type="hidden" name="returnTo" value={back} />
            <button className="btn-danger" type="submit">
              Delete this project
            </button>
          </form>
        </Section>
      ) : null}
    </>
  );
}
