import Link from "next/link";
import type { ForecastStatus } from "@/lib/forecast";
import type { TaskStatus } from "@/lib/recurrence";
import {
  IconAlert,
  IconCheck,
  IconChevronLeft,
  IconClock,
  IconPause,
} from "@/components/icons";

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
    <div className="mb-5">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-[var(--subtle)] transition-colors hover:text-[var(--text)]"
        >
          <IconChevronLeft className="h-4 w-4" />
          {backLabel ?? "Back"}
        </Link>
      ) : null}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[var(--text)]">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--subtle)]">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/** The core visual unit: one card per section of content. */
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
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="eyebrow">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-xs text-[var(--subtle)]">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/**
 * Related sub-sections inside a single card, separated by rules rather than
 * split into several cards.
 */
export function SplitCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </section>
  );
}

export function SplitPane({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-sm text-[var(--subtle)]">{children}</p>;
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
        {required ? <span className="text-[var(--accent)]"> *</span> : null}
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
      {hint ? (
        <p className="mt-1.5 text-xs text-[var(--faint)]">{hint}</p>
      ) : null}
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
        {required ? <span className="text-[var(--accent)]"> *</span> : null}
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
      {hint ? (
        <p className="mt-1.5 text-xs text-[var(--faint)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "red" | "amber" | "accent" | "green";
}) {
  const tones = {
    neutral: "border-[var(--border)] bg-[var(--surface-solid)] text-[var(--muted)]",
    red: "border-red-500/40 bg-red-500/10 text-red-300",
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    accent: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
    green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status lamps
// ---------------------------------------------------------------------------

type Lamp = "red" | "amber" | "green" | "idle";

const LAMP_STYLES: Record<Lamp, string> = {
  red: "border-red-500/40 bg-red-500/15 text-red-400 shadow-[0_0_14px_rgba(248,113,113,0.4)]",
  amber:
    "border-amber-500/40 bg-amber-500/15 text-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.35)]",
  green:
    "border-emerald-500/40 bg-emerald-500/15 text-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.35)]",
  idle: "border-[var(--border)] bg-[var(--surface-solid)] text-[var(--subtle)]",
};

/**
 * The glowing lamp. Full size for detail views; `sm` for table rows, where a
 * 44px circle per row would overwhelm the data it's annotating.
 */
export function StatusLamp({
  tone,
  size = "sm",
  children,
}: {
  tone: Lamp;
  size?: "sm" | "lg";
  children: React.ReactNode;
}) {
  const box = size === "lg" ? "h-11 w-11" : "h-8 w-8";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${box} ${LAMP_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Lamp plus its label — the label stays for screen readers and scanning. */
function LampWithLabel({
  tone,
  label,
  size = "sm",
  Icon,
}: {
  tone: Lamp;
  label: string;
  size?: "sm" | "lg";
  Icon: (props: { className?: string }) => React.ReactElement;
}) {
  const text =
    tone === "red"
      ? "text-red-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "green"
          ? "text-emerald-300"
          : "text-[var(--subtle)]";
  return (
    <span className="inline-flex items-center gap-2">
      <StatusLamp tone={tone} size={size}>
        <Icon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      </StatusLamp>
      <span className={`text-xs font-medium ${text}`}>{label}</span>
    </span>
  );
}

const FORECAST_LAMP: Record<
  ForecastStatus,
  { tone: Lamp; label: string; Icon: (p: { className?: string }) => React.ReactElement }
> = {
  OVERDUE: { tone: "red", label: "Past expected life", Icon: IconAlert },
  DUE_SOON: { tone: "amber", label: "Replacement window", Icon: IconAlert },
  WATCH: { tone: "amber", label: "Within 2 years", Icon: IconClock },
  OK: { tone: "green", label: "OK", Icon: IconCheck },
};

export function ForecastBadge({
  status,
  size,
}: {
  status: ForecastStatus;
  size?: "sm" | "lg";
}) {
  const { tone, label, Icon } = FORECAST_LAMP[status];
  return <LampWithLabel tone={tone} label={label} Icon={Icon} size={size} />;
}

const TASK_LAMP: Record<
  TaskStatus,
  { tone: Lamp; label: string; Icon: (p: { className?: string }) => React.ReactElement }
> = {
  OVERDUE: { tone: "red", label: "Overdue", Icon: IconAlert },
  DUE_SOON: { tone: "amber", label: "Due soon", Icon: IconClock },
  UPCOMING: { tone: "idle", label: "Upcoming", Icon: IconClock },
};

export function TaskBadge({
  status,
  active,
  size,
}: {
  status: TaskStatus;
  active: boolean;
  size?: "sm" | "lg";
}) {
  if (!active) {
    return <LampWithLabel tone="idle" label="Paused" size={size} Icon={IconPause} />;
  }
  const { tone, label, Icon } = TASK_LAMP[status];
  return <LampWithLabel tone={tone} label={label} Icon={Icon} size={size} />;
}

/** Small "live" indicator — a dot that pulses. */
export function PulseDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
    </span>
  );
}

/** Server-action error surfaced back to a form via ?error= */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
      <IconAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3.5 py-2.5 text-sm text-[var(--accent-strong)]">
      <IconCheck className="mt-0.5 h-5 w-5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
