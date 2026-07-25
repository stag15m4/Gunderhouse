import type { Appliance } from "@prisma/client";
import { Field, SelectField, TextareaField } from "@/components/ui";
import { dateInputValue } from "@/lib/format";
import { APPLIANCE_CATEGORY_LABELS, enumOptions } from "@/lib/labels";

export function ApplianceForm({
  action,
  appliance,
  submitLabel,
}: {
  action: (form: FormData) => void | Promise<void>;
  appliance?: Appliance;
  submitLabel: string;
}) {
  return (
    <form action={action} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          name="name"
          required
          defaultValue={appliance?.name}
          placeholder="Basement water heater"
        />
        <SelectField
          label="Category"
          name="category"
          options={enumOptions(APPLIANCE_CATEGORY_LABELS)}
          defaultValue={appliance?.category ?? "OTHER"}
          hint="Sets the expected service life used by the forecast."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand" name="brand" defaultValue={appliance?.brand} />
        <Field
          label="Model number"
          name="modelNumber"
          defaultValue={appliance?.modelNumber}
        />
        <Field
          label="Serial number"
          name="serialNumber"
          defaultValue={appliance?.serialNumber}
        />
        <Field
          label="Location in the home"
          name="location"
          defaultValue={appliance?.location}
          placeholder="Utility closet, upstairs"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="In service since"
          name="installedOn"
          type="date"
          defaultValue={dateInputValue(appliance?.installedOn)}
          hint="Install date. Without it, this item is left out of the forecast."
        />
        <Field
          label="Warranty expires"
          name="warrantyExpiresOn"
          type="date"
          defaultValue={dateInputValue(appliance?.warrantyExpiresOn)}
        />
      </div>

      <TextareaField label="Notes" name="notes" defaultValue={appliance?.notes} />

      <button className="btn" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
