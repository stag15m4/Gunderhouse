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
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Item</th>
                <th>How often</th>
                <th>Next due</th>
                <th>Last done</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div className="font-medium text-stone-900">{task.title}</div>
                    {task.notes ? (
                      <div className="text-xs text-stone-500">{task.notes}</div>
                    ) : null}
                  </td>
                  <td className="text-xs">
                    {task.applianceId ? (
                      <Link
                        className="hover:underline"
                        href={`/homes/${homeId}/appliances/${task.applianceId}`}
                      >
                        {task.applianceName}
                      </Link>
                    ) : (
                      <span className="text-stone-400">Home-level</span>
                    )}
                  </td>
                  <td className="text-xs">{task.cadence}</td>
                  <td className="whitespace-nowrap">
                    {formatDate(task.nextDueOn)}
                    <div className="mt-0.5">
                      <TaskBadge status={task.status} active={task.active} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-xs text-stone-500">
                    {task.lastCompletedOn
                      ? formatDate(task.lastCompletedOn)
                      : "Never"}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {canEdit(role) ? (
                      <>
                        <form
                          action={markTaskComplete.bind(null, homeId, task.id)}
                        >
                          <button className="btn-secondary" type="submit">
                            Mark done
                          </button>
                        </form>
                        <Link
                          className="mt-1 block text-xs text-stone-500 hover:text-stone-900"
                          href={`/homes/${homeId}/tasks/${task.id}/edit`}
                        >
                          Edit
                        </Link>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {canEdit(role) ? (
          <details className="mt-4 border-t border-stone-100 pt-4">
            <summary className="cursor-pointer text-sm font-medium text-stone-700">
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
          <table className="table">
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
                      <div className="text-xs text-stone-500">{entry.notes}</div>
                    ) : null}
                    {entry.createdBy ? (
                      <div className="text-xs text-stone-400">
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
                      <span className="text-stone-400">Home-level</span>
                    )}
                  </td>
                  <td>{entry.vendor ?? "—"}</td>
                  <td className="text-right">{formatMoney(entry.costCents)}</td>
                  <td className="whitespace-nowrap text-right">
                    {canEdit(role) ? (
                      <Link
                        className="text-xs text-stone-500 hover:text-stone-900"
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
                          className="text-xs text-red-600 hover:text-red-800"
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
        )}
      </div>
    </>
  );
}
