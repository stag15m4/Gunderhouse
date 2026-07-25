import { NextResponse } from "next/server";
import { checkAlfredToken } from "@/lib/alfred";

export const dynamic = "force-dynamic";

/** Self-describing index of the read-only integration surface. */
export async function GET(request: Request) {
  const denied = checkAlfredToken(request);
  if (denied) return denied;

  return NextResponse.json({
    app: "gunderhouse",
    version: 1,
    access: "read-only",
    auth: { header: "X-Alfred-Token" },
    endpoints: [
      {
        path: "/api/alfred/homes",
        description: "All homes with basic facts and record counts.",
        params: {},
      },
      {
        path: "/api/alfred/appliances",
        description: "Appliances and home systems, newest install first.",
        params: {
          home: "home id or name (optional; omit for all homes)",
          category: "appliance category enum (optional)",
        },
      },
      {
        path: "/api/alfred/maintenance",
        description: "Maintenance and repair entries, most recent first.",
        params: {
          home: "home id or name (optional)",
          applianceId: "restrict to one appliance (optional)",
          from: "YYYY-MM-DD inclusive (optional)",
          to: "YYYY-MM-DD inclusive (optional)",
          limit: "max entries, default 100, max 500 (optional)",
        },
      },
      {
        path: "/api/alfred/forecast",
        description:
          "Appliances flagged against typical service life, most urgent first.",
        params: {
          home: "home id or name (optional)",
          includeOk:
            "'1' to include items that are not yet near replacement (optional)",
        },
      },
    ],
    notes:
      "Writes are not part of this contract. Logging maintenance from Alfred " +
      "would need an explicit confirm-first flow added separately.",
  });
}
