import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Alfred / Lucy integration
 * -------------------------
 * Read-only JSON endpoints under /api/alfred/*, authenticated by a shared
 * secret in the `X-Alfred-Token` header compared against ALFRED_TOKEN. These
 * routes carry no user session and no per-home permissions — the token is the
 * whole check, so treat it as full read access to the household's data.
 *
 * Writes are deliberately absent. If Alfred should ever log maintenance, that
 * belongs behind an explicit confirm-first flow, not bolted onto this contract.
 */

export function checkAlfredToken(request: Request): NextResponse | null {
  const expected = process.env.ALFRED_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Integration is not configured." },
      { status: 503 },
    );
  }

  const provided = request.headers.get("x-alfred-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** ISO date (no time) — the shape Alfred/Lucy expect for a calendar date. */
export function isoDate(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/**
 * Resolve the `home` query param, which accepts either a home id or its name
 * (case-insensitive), so Alfred can pass through whatever the user said.
 * Returns null when the param is absent, meaning "all homes".
 */
export async function resolveHome(
  url: URL,
): Promise<{ id: string; name: string } | null | "not_found"> {
  const value = url.searchParams.get("home") ?? url.searchParams.get("homeId");
  if (!value) return null;

  const home = await prisma.home.findFirst({
    where: {
      OR: [{ id: value }, { name: { equals: value, mode: "insensitive" } }],
    },
    select: { id: true, name: true },
  });

  return home ?? "not_found";
}

export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Parse a YYYY-MM-DD query param into a UTC-midnight Date. */
export function dateParam(url: URL, key: string): Date | null {
  const value = url.searchParams.get(key);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
