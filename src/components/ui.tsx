import Link from "next/link";
import type { ForecastStatus } from "@/lib/forecast";

export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-6">
      {backHref ? (
        <Link
          href={backHref}
          className="text-sm text-stone-500 hover:text-stone-800"
        >
          ← {backLabel ?? "Back"}
        </Link>
      ) : null}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-stone-500">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-stone-500">{children}</p>;
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  hint,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        className="input"
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
      />
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

export function TextareaField({
  label,
  name,
  defaultValue,
  rows = 3,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <textarea
        className="input"
        id={name}
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
      />
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  hint,
  includeBlank,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string | null;
  hint?: string;
  includeBlank?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select
        className="input"
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
      >
        {includeBlank ? <option value="">{includeBlank}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "red" | "amber" | "blue" | "green";
}) {
  const tones = {
    neutral: "bg-stone-100 text-stone-700",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-900",
    blue: "bg-blue-100 text-blue-800",
    green: "bg-emerald-100 text-emerald-800",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const FORECAST_TONE: Record<
  ForecastStatus,
  { tone: "red" | "amber" | "blue" | "green"; label: string }
> = {
  OVERDUE: { tone: "red", label: "Past expected life" },
  DUE_SOON: { tone: "amber", label: "Replacement window" },
  WATCH: { tone: "blue", label: "Within 2 years" },
  OK: { tone: "green", label: "OK" },
};

export function ForecastBadge({ status }: { status: ForecastStatus }) {
  const { tone, label } = FORECAST_TONE[status];
  return <Badge tone={tone}>{label}</Badge>;
}

/** Server-action error surfaced back to a form via ?error= */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </div>
  );
}
