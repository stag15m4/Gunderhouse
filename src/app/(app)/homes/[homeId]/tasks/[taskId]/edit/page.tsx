import { notFound } from "next/navigation";
import { HomeRole } from "@prisma/client";
import { deleteTask, updateTask } from "@/app/actions/tasks";
import { canAdminister, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { describeInterval } from "@/lib/recurrence";
import { TaskForm } from "@/components/TaskForm";
import { Empty, FormError, PageHeader, Section } from "@/components/ui";

export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string; taskId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { homeId, taskId } = await params;
  const { error } = await searchParams;
  const { home, role } = await requireHome(homeId, HomeRole.MEMBER);

  const [task, appliances] = await Promise.all([
    prisma.maintenanceTask.findUnique({
      where: { id: taskId },
      include: {
        completions: {
          orderBy: { performedOn: "desc" },
          take: 10,
          include: { createdBy: { select: { name: true } } },
        },
      },
    }),
    prisma.appliance.findMany({
      where: { homeId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!task || task.homeId !== homeId) notFound();

  const update = updateTask.bind(null, homeId, taskId);
  const remove = deleteTask.bind(null, homeId, taskId);

  return (
    <>
      <PageHeader
        title={task.title}
        subtitle={`${describeInterval(task.intervalValue, task.intervalUnit)} · ${home.name}`}
        backHref={`/homes/${homeId}/maintenance`}
        backLabel="Maintenance log"
      />
      <FormError message={error} />

      <Section title="Schedule">
        <TaskForm
          action={update}
          appliances={appliances}
          task={task}
          submitLabel="Save changes"
          showActiveToggle
        />
      </Section>

      <Section title="Completion history">
        {task.completions.length === 0 ? (
          <Empty>Not completed yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[36rem]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Logged by</th>
                <th>Notes</th>
                <th className="text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {task.completions.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap">
                    {formatDate(entry.performedOn)}
                  </td>
                  <td className="text-xs">
                    {entry.loggedVia === "ALFRED"
                      ? "Alfred / Lucy"
                      : (entry.createdBy?.name ?? "—")}
                  </td>
                  <td className="text-xs">{entry.notes ?? "—"}</td>
                  <td className="text-right">{formatMoney(entry.costCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Section>

      {canAdminister(role) ? (
        <Section
          title="Delete"
          description="Past completions stay in the maintenance log."
        >
          <form action={remove}>
            <button className="btn-danger" type="submit">
              Delete this task
            </button>
          </form>
        </Section>
      ) : null}
    </>
  );
}
