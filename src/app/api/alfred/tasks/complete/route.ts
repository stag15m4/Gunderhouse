import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { LogSource } from "@prisma/client";
import { z } from "zod";
import { checkAlfredToken, isoDate } from "@/lib/alfred";
import { prisma } from "@/lib/prisma";
import { completeTask } from "@/lib/tasks";
import { addInterval, describeInterval } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

/**
 * The only write Alfred and Lucy can make, and it takes two round trips.
 *
 *   1. POST { taskId, ... }          → nothing changes. Returns a plain-language
 *                                      summary and a confirmationToken.
 *   2. POST { confirmationToken }    → applies exactly what the summary described.
 *
 * The assistant is expected to read the summary back and get a human "yes"
 * before step 2. That's the point of splitting it: the model can't record work
 * on a misheard sentence, because the person hears the interpretation first.
 *
 * Tokens are single-use and expire in five minutes, so a stale or replayed
 * confirmation writes nothing.
 */
const CONFIRMATION_TTL_MS = 5 * 60 * 1000;

const proposeSchema = z.object({
  taskId: z.string().min(1),
  completedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "completedOn must be YYYY-MM-DD")
    .optional(),
  notes: z.string().max(2000).optional(),
  vendor: z.string().max(200).optional(),
  costUsd: z.number().nonnegative().optional(),
});

const confirmSchema = z.object({ confirmationToken: z.string().min(1) });

type ProposedCompletion = z.infer<typeof proposeSchema> & {
  completedOn: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function POST(request: Request) {
  const denied = checkAlfredToken(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  // ---- step 2: a confirmation coming back ---------------------------------
  const confirming = confirmSchema.safeParse(body);
  if (confirming.success) {
    return applyConfirmation(confirming.data.confirmationToken);
  }

  // ---- step 1: a proposal --------------------------------------------------
  const proposal = proposeSchema.safeParse(body);
  if (!proposal.success) {
    return NextResponse.json(
      {
        error: "Send either { taskId, ... } to propose, or { confirmationToken } to confirm.",
        details: proposal.error.issues.map((i) => i.message),
      },
      { status: 400 },
    );
  }

  const task = await prisma.maintenanceTask.findUnique({
    where: { id: proposal.data.taskId },
    include: {
      home: { select: { name: true } },
      appliance: { select: { name: true } },
    },
  });
  if (!task) {
    return NextResponse.json({ error: "No such task." }, { status: 404 });
  }

  const completedOn = proposal.data.completedOn ?? today();
  const payload: ProposedCompletion = { ...proposal.data, completedOn };

  const scope = task.appliance ? ` (${task.appliance.name})` : "";
  const when = completedOn === today() ? "today" : `on ${completedOn}`;
  const cost =
    payload.costUsd !== undefined ? `, costing $${payload.costUsd.toFixed(2)}` : "";
  const who = payload.vendor ? `, done by ${payload.vendor}` : "";
  const summary =
    `Record "${task.title}"${scope} at ${task.home.name} as completed ${when}${who}${cost}. ` +
    `This adds an entry to the maintenance log and moves the next due date to ` +
    `${isoDate(addInterval(parseDate(completedOn), task.intervalValue, task.intervalUnit))} ` +
    `(${describeInterval(task.intervalValue, task.intervalUnit)}).`;

  const confirmation = await prisma.alfredConfirmation.create({
    data: {
      token: randomBytes(24).toString("hex"),
      action: "complete_task",
      summary,
      payload,
      expiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS),
    },
  });

  return NextResponse.json({
    status: "confirmation_required",
    summary,
    confirmationToken: confirmation.token,
    expiresAt: confirmation.expiresAt.toISOString(),
    instructions:
      "Read the summary to the user. If they agree, POST { confirmationToken } " +
      "back to this endpoint. Nothing has been recorded yet.",
    task: {
      id: task.id,
      title: task.title,
      homeName: task.home.name,
      appliance: task.appliance?.name ?? null,
      currentNextDueOn: isoDate(task.nextDueOn),
      lastCompletedOn: isoDate(task.lastCompletedOn),
    },
  });
}

async function applyConfirmation(token: string): Promise<NextResponse> {
  const confirmation = await prisma.alfredConfirmation.findUnique({
    where: { token },
  });

  if (!confirmation || confirmation.action !== "complete_task") {
    return NextResponse.json(
      { error: "Unknown confirmation token." },
      { status: 404 },
    );
  }
  if (confirmation.usedAt) {
    return NextResponse.json(
      { error: "That confirmation was already used. Propose the change again." },
      { status: 409 },
    );
  }
  if (confirmation.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "That confirmation expired. Propose the change again." },
      { status: 410 },
    );
  }

  const payload = confirmation.payload as ProposedCompletion;
  const task = await prisma.maintenanceTask.findUnique({
    where: { id: payload.taskId },
  });
  if (!task) {
    return NextResponse.json(
      { error: "The task no longer exists." },
      { status: 404 },
    );
  }

  // Burn the token first: a crash mid-write must not leave it replayable.
  await prisma.alfredConfirmation.update({
    where: { id: confirmation.id },
    data: { usedAt: new Date() },
  });

  const { entryId, task: updated } = await completeTask(task, {
    completedOn: parseDate(payload.completedOn),
    notes: payload.notes ?? null,
    vendor: payload.vendor ?? null,
    costCents:
      payload.costUsd === undefined ? null : Math.round(payload.costUsd * 100),
    loggedVia: LogSource.ALFRED,
  });

  return NextResponse.json({
    status: "completed",
    summary: confirmation.summary,
    maintenanceEntryId: entryId,
    task: {
      id: updated.id,
      title: updated.title,
      lastCompletedOn: isoDate(updated.lastCompletedOn),
      nextDueOn: isoDate(updated.nextDueOn),
    },
  });
}
