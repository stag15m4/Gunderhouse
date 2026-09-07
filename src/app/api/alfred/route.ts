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
    access: {
      reads: "unrestricted",
      writes: "confirm-first; completing a routine task is the only one",
    },
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
        description:
          "Maintenance and repair entries, most recent first. Entries carry " +
          "`task` when they were a routine-task completion, and `loggedVia` " +
          "(APP or ALFRED) identifying where the write came from.",
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
          "Appliances flagged against expected service life, most urgent first, " +
          "plus planned projects and a combined cost total.",
        params: {
          home: "home id or name (optional)",
          includeOk:
            "'1' to include items that are not yet near replacement (optional)",
        },
      },
      {
        path: "/api/alfred/budget",
        description:
          "The household budget for a month: income, expense categories with " +
          "their recurring charges, and what each house cost. Every figure is " +
          "monthly; recurring charges are smoothed rather than billed-in-month.",
        params: {
          month: "YYYY-MM (optional, defaults to the current month)",
          home: "home id or name (optional; restricts the homes section)",
        },
      },
      {
        path: "/api/alfred/property",
        description:
          "What each property is worth, what's owed against it, the equity " +
          "that leaves, and for rentals what the place has to earn to cover " +
          "its costs.",
        params: { home: "home id or name (optional)" },
      },
      {
        path: "/api/alfred/tasks",
        description:
          "Routine maintenance tasks and when they're next due, most urgent first.",
        params: {
          home: "home id or name (optional)",
          status: "'due' (default: overdue and due soon) or 'all'",
        },
      },
    ],
    writes: [
      {
        path: "/api/alfred/tasks/complete",
        method: "POST",
        description: "Mark a routine task complete. Two steps, always.",
        steps: [
          {
            step: 1,
            body: {
              taskId: "required",
              completedOn: "YYYY-MM-DD (optional, defaults to today)",
              notes: "optional",
              vendor: "optional",
              costUsd: "number, optional",
            },
            effect:
              "Nothing is recorded. Returns a plain-language summary and a " +
              "confirmationToken valid for 5 minutes.",
          },
          {
            step: 2,
            body: { confirmationToken: "the token from step 1" },
            effect:
              "Applies exactly what the summary described: logs a maintenance " +
              "entry and rolls the task's due date forward.",
          },
        ],
        expectation:
          "Read the step 1 summary back to the user and get an explicit yes " +
          "before sending step 2. Tokens are single-use.",
      },
    ],
    notes:
      "Completing a routine task is the only write available. Everything else " +
      "is read-only.",
  });
}
