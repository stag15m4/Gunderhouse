import type { Home } from "@prisma/client";
import { Field, SelectField, TextareaField } from "@/components/ui";
import { dateInputValue } from "@/lib/format";
import { enumOptions, HOME_TYPE_LABELS } from "@/lib/labels";

export function HomeForm({
  action,
  home,
  submitLabel,
}: {
  action: (form: FormData) => void | Promise<void>;
  home?: Home;
  submitLabel: string;
}) {
  return (
    <form action={action} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          name="name"
          required
          defaultValue={home?.name}
          placeholder="Main house"
        />
        <SelectField
          label="Type"
          name="type"
          options={enumOptions(HOME_TYPE_LABELS)}
          defaultValue={home?.type ?? "PRIMARY_RESIDENCE"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address" name="addressLine1" defaultValue={home?.addressLine1} />
        <Field
          label="Address line 2"
          name="addressLine2"
          defaultValue={home?.addressLine2}
        />
        <Field label="City" name="city" defaultValue={home?.city} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="State" name="state" defaultValue={home?.state} />
          <Field label="ZIP" name="postalCode" defaultValue={home?.postalCode} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Year built"
          name="yearBuilt"
          type="number"
          defaultValue={home?.yearBuilt}
        />
        <Field
          label="Square feet"
          name="squareFeet"
          type="number"
          defaultValue={home?.squareFeet}
        />
        <Field
          label="Purchased on"
          name="purchasedOn"
          type="date"
          defaultValue={dateInputValue(home?.purchasedOn)}
        />
      </div>

      <TextareaField label="Notes" name="notes" defaultValue={home?.notes} />

      <button className="btn" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
