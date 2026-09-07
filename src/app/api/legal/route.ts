import { NextResponse } from "next/server";
import { checkLegalToken } from "@/lib/legal";

export const dynamic = "force-dynamic";

/** Self-describing index of the Legal integration surface. */
export async function GET(request: Request) {
  const denied = checkLegalToken(request);
  if (denied) return denied;

  return NextResponse.json({
    app: "gunderhouse",
    surface: "legal",
    version: 1,
    auth: { header: "X-Legal-Token" },
    model:
      "Legal is the system of record for instruments secured against a " +
      "property; Gunderhouse is the system of record for what the property " +
      "is worth. Legal writes liens here and reads back the equity that " +
      "results. Liens written here are owned by Legal and cannot be edited " +
      "in the Gunderhouse UI.",
    endpoints: [
      {
        path: "/api/legal/properties",
        method: "GET",
        description:
          "Every property, with address and current valuation, so matters " +
          "can be mapped to a propertyId.",
        params: {},
      },
      {
        path: "/api/legal/liens",
        method: "GET",
        description: "Liens on record, with the equity picture per property.",
        params: { property: "property id or name (optional)" },
      },
      {
        path: "/api/legal/liens",
        method: "PUT",
        description:
          "Replace the full set of Legal-owned liens for one property. " +
          "Idempotent: send the complete current set every time. Liens " +
          "absent from the payload are released, and manually-entered liens " +
          "are never touched.",
        body: {
          propertyId: "required",
          liens: "array; each needs externalId, type, lender, balanceUsd",
        },
      },
    ],
  });
}
