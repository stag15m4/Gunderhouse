import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Legal app integration
 * ---------------------
 * JSON endpoints under /api/legal/*, authenticated by a shared secret in the
 * `X-Legal-Token` header compared against LEGAL_TOKEN. A separate secret from
 * ALFRED_TOKEN on purpose: these are different callers with different reach,
 * and one being compromised shouldn't hand over the other's surface.
 *
 * Direction of trust
 * ------------------
 * Legal is the system of record for anything with a filing behind it — a
 * mortgage, a HELOC, a judgment. Gunderhouse is the system of record for what
 * the property is worth. So Legal *writes* liens here and *reads* valuations,
 * and the equity arithmetic happens here, where both halves meet.
 *
 * Why this write isn't confirm-first
 * ----------------------------------
 * The Alfred writes are confirm-first because an assistant is acting on a
 * person's spoken instruction and could have misheard it. This is a system
 * sync: an idempotent restatement of what Legal already holds, keyed by
 * Legal's own ids. Asking a person to confirm every sync would make it useless
 * and teach them to confirm without reading. The safety comes from a different
 * place — the sync can only touch rows it owns (source LEGAL), so a bug or a
 * bad payload can never damage a hand-entered lien.
 *
 * The contract is documented in docs/legal-integration.md; keep it in step
 * with these handlers.
 */

export function checkLegalToken(request: Request): NextResponse | null {
  const expected = process.env.LEGAL_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "Legal integration is not configured." },
      { status: 503 },
    );
  }

  const provided = request.headers.get("x-legal-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function legalNotFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}
