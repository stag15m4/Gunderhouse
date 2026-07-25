import type { MaintenanceTask } from "@prisma/client";
import { Field, SelectField, TextareaField } from "@/components/ui";
import { dateInputValue } from "@/lib/format";
import { RECURRENCE_UNIT_LABELS } from "@/lib/recurrence";

const UNIT_OPTIONS = (
  Object.keys(RECURRENCE_UNIT_LABELS) as Array<
    keyof typeof RECURRENCE_UNIT_LABELS
  >
).map((value) => ({ value, label: RECURRENCE_UNIT_LABELS[value] }));

export function TaskForm({
  action,
  appliances,
  task,
  submitLabel,
  showActiveToggle,
}: {
  action: (form: FormData) => void | Promise<void>;
  appliances: Array<{ id: string; name: string }>;
  task?: MaintenanceTask;
  submitLabel: string;
  showActiveToggle?: boolean;
}) {
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Task"
          name="title"
          required
          defaultValue={task?.title}
          placeholder="Replace furnace filter"
        />
        <SelectField
          label="Appliance or system"
          name="applianceId"
          includeBlank="Not tied to one (home-level)"
          defaultValue={task?.applianceId}
          options={appliances.map((a) => ({ value: a.id, label: a.name }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Repeat every"
          name="intervalValue"
          type="number"
          required
          defaultValue={task?.intervalValue ?? 3}
          hint="A whole number."
        />
        <SelectField
          label="Unit"
          name="intervalUnit"
          options={UNIT_OPTIONS}
          defaultValue={task?.intervalUnit ?? "MONTH"}
        />
        <Field
          label="Next due"
          name="nextDueOn"
          type="date"
          required
          defaultValue={dateInputValue(task?.nextDueOn)}
          hint="Rolls forward from each completion."
        />
      </div>

      <TextareaField label="Notes" name="notes" rows={2} defaultValue={task?.notes} />

      {showActiveToggle ? (
        <SelectField
          label="Status"
          name="active"
          defaultValue={task?.active === false ? "false" : "true"}
          options={[
            { value: "true", label: "Active" },
            { value: "false", label: "Paused — keeps history, stops coming due" },
          ]}
        />
      ) : null}

      <button className="btn" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
