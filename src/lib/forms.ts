/** Helpers for reading plain HTML form posts out of FormData. */

export function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Trimmed string, or null when the field was left blank. */
export function optionalStr(form: FormData, key: string): string | null {
  const value = str(form, key);
  return value === "" ? null : value;
}

export function optionalInt(form: FormData, key: string): number | null {
  const value = str(form, key);
  if (value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Dates come from <input type="date"> as YYYY-MM-DD. Parse them at UTC midnight
 * so a date never shifts a day depending on the server's timezone.
 */
export function optionalDate(form: FormData, key: string): Date | null {
  const value = str(form, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function requiredDate(form: FormData, key: string): Date {
  const parsed = optionalDate(form, key);
  if (!parsed) throw new Error(`A valid date is required for "${key}".`);
  return parsed;
}

/** Dollar amounts entered as text ("1,250.00") stored as integer cents. */
export function optionalMoneyCents(form: FormData, key: string): number | null {
  const raw = str(form, key).replace(/[$,\s]/g, "");
  if (raw === "") return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

/**
 * Read a form field that must be one of an enum's values, falling back when it
 * isn't. `allowed` is the enum object itself (e.g. Prisma's `HomeRole`), so the
 * result is typed as the full union rather than narrowed to the fallback.
 */
export function enumValue<T extends Record<string, string>>(
  form: FormData,
  key: string,
  allowed: T,
  fallback: T[keyof T],
): T[keyof T] {
  const value = str(form, key);
  return (value in allowed ? value : fallback) as T[keyof T];
}

export function requireText(form: FormData, key: string, label: string): string {
  const value = str(form, key);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}
