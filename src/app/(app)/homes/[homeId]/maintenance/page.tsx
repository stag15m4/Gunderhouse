import Link from "next/link";
import { canAdminister, canEdit, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  createMaintenanceEntry,
  deleteMaintenanceEntry,
} from "@/app/actions/maintenance";
import { createTask, markTaskComplete } from "@/app/actions/tasks";
import { formatDate, formatMoney } from "@/lib/format";
import { sortTasks, toTaskView } from "@/lib/recurrence";
import { TaskForm } from "@/components/TaskForm";
import {
  Empty,
  Field,
  FormError,
  PageHeader,
  SelectField,
  Section,
  TaskBadge,
  TextareaField,
} from "@/components/ui";

export default async function MaintenancePage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>;
  searchParams: Promise<{ error?: string; year?: string }>;
}) {
  const { homeId } = await params;
  const { error, year } = await searchParams;
  const { home, role } = await requireHome(homeId);

  const selectedYear = year ? Number.parseInt(year, 10) : null;
  const yearFilter =
    selectedYear && Number.isFinite(selectedYear)
      ? {
          performedOn: {
            gte: new Date(Date.UTC(selectedYear, 0, 1)),
            lt: new Date(Date.UTC(selectedYear + 1, 0, 1)),
          },
        }
      : {};

  const [entries, appliances, total, taskRows] = await Promise.all([
    prisma.maintenanceEntry.findMany({
      where: { homeId, ...yearFilter },
      orderBy: { performedOn: "desc" },
      include: {
        appliance: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.appliance.findMany({
      where: { homeId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.maintenanceEntry.aggregate({
      where: { homeId, ...yearFilter },
      _sum: { costCents: true },
    }),
    prisma.maintenanceTask.findMany({
      where: { homeId },
      include: { appliance: { select: { name: true } } },
    }),
  ]);

  const tasks = sortTasks(taskRows.map((task) => toTaskView(task)));
  const logWork = createMaintenanceEntry.bind(null, homeId);
  const addTask = createTask.bind(null, homeId);

  return (
    <>
      <PageHeader
        title="Maintenance log"
        subtitle={`${home.name} · ${entries.length} entries · ${formatMoney(
          total._sum.costCents ?? 0,
        )} total`}
        backHref={`/homes/${homeId}`}
        backLabel={home.name}
      />

      <FormError message={error} />

      <Section
        title="Routine tasks"
        description="Jobs that repeat. Completing one logs it below and moves the due date forward."
      >
        {tasks.length === 0 ? (
          <Empty>
            Nothing scheduled yet. Add a recurring job below — filters, gutters,
            servicing.
          </Empty>
        ) : (
          /*
           * A list rather than a table: "Mark done" is the action this page
           * exists for, and in a table on a phone it ends up off the right edge
           * behind a horizontal scroll.
           */
          <ul className="divide-y divide-[var(--border)]">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--text)]">
                    {task.title}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--subtle)]">
                    {task.applianceId ? (
                      <Link
                        className="hover:text-[var(--text)]"
                        href={`/homes/${homeId}/appliances/${task.applianceId}`}
                      >
                        {task.applianceName}
                      </Link>
                    ) : (
                      <span className="text-[var(--faint)]">Home-level</span>
                    )}
                    {" · "}
                    {task.cadence}
                  </div>
                  <div className="mt-2">
                    <TaskBadge status={task.status} active={task.active} />
                  </div>
                  <div className="mt-1.5 text-xs text-[var(--faint)]">
                    Next due {formatDate(task.nextDueOn)}
                    {" · Last done "}
                    {task.lastCompletedOn
                      ? formatDate(task.lastCompletedOn)
                      : "never"}
                  </div>
                  {task.notes ? (
                    <div className="mt-1.5 text-xs text-[var(--subtle)]">
                      {task.notes}
                    </div>
                  ) : null}
                </div>

                {canEdit(role) ? (
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <form action={markTaskComplete.bind(null, homeId, task.id)}>
                      <button className="btn-secondary" type="submit">
                        Mark done
                      </button>
                    </form>
                    <Link
                      className="text-xs text-[var(--subtle)] transition-colors hover:text-[var(--text)]"
                      href={`/homes/${homeId}/tasks/${task.id}/edit`}
                    >
                      Edit
                    </Link>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canEdit(role) ? (
          <details className="mt-4 border-t border-[var(--border-soft)] pt-4">
            <summary className="cursor-pointer text-sm font-medium text-[var(--muted)]">
              Add a routine task
            </summary>
            <div className="mt-4">
              <TaskForm
                action={addTask}
                appliances={appliances}
                submitLabel="Add task"
              />
            </div>
          </details>
        ) : null}
      </Section>

      {canEdit(role) ? (
        <Section
          title="Log work"
          description="Leave the appliance blank for home-level work like roofing or landscaping."
        >
          <form action={logWork} className="space-y-4">
            <input
              type="hidden"
              name="returnTo"
              value={`/homes/${homeId}/maintenance`}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date" name="performedOn" type="date" required />
              <SelectField
                label="Appliance or system"
                name="applianceId"
                includeBlank="Home-level (not a specific item)"
                options={appliances.map((a) => ({ value: a.id, label: a.name }))}
              />
              <Field label="Cost" name="cost" placeholder="0.00" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Description"
                name="description"
                required
                placeholder="Annual furnace service"
              />
              <Field
                label="Vendor"
                name="vendor"
                placeholder="Who did the work"
              />
            </div>
            <TextareaField label="Notes" name="notes" rows={2} />
            <button className="btn" type="submit">
              Add entry
            </button>
          </form>
        </Section>
      ) : null}

      <div className="card p-4">
        {entries.length === 0 ? (
          <Empty>No maintenance logged yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[36rem]">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th>Item</th>
                <th>Vendor</th>
                <th className="text-right">Cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap">
                    {formatDate(entry.performedOn)}
                  </td>
                  <td>
                    {entry.description}
                    {entry.notes ? (
                      <div className="text-xs text-[var(--subtle)]">{entry.notes}</div>
                    ) : null}
                    {entry.createdBy ? (
                      <div className="text-xs text-[var(--faint)]">
                        Logged by {entry.createdBy.name}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {entry.appliance ? (
                      <Link
                        className="hover:underline"
                        href={`/homes/${homeId}/appliances/${entry.appliance.id}`}
                      >
                        {entry.appliance.name}
                      </Link>
                    ) : (
                      <span className="text-[var(--faint)]">Home-level</span>
                    )}
                  </td>
                  <td>{entry.vendor ?? "—"}</td>
                  <td className="text-right">{formatMoney(entry.costCents)}</td>
                  <td className="whitespace-nowrap text-right">
                    {canEdit(role) ? (
                      <Link
                        className="text-xs text-[var(--subtle)] hover:text-[var(--text)]"
                        href={`/homes/${homeId}/maintenance/${entry.id}/edit`}
                      >
                        Edit
                      </Link>
                    ) : null}
                    {canAdminister(role) ? (
                      <form
                        className="mt-1"
                        action={deleteMaintenanceEntry.bind(
                          null,
                          homeId,
                          entry.id,
                        )}
                      >
                        <button
                          className="text-xs text-red-400 hover:text-red-300"
                          type="submit"
                        >
                          Delete
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}
