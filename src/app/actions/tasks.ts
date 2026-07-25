"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { HomeRole, RecurrenceUnit } from "@prisma/client";
import { AccessError, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { completeTask } from "@/lib/tasks";
import {
  enumValue,
  optionalMoneyCents,
  optionalStr,
  requiredDate,
  requireText,
  str,
} from "@/lib/forms";
import { isRedirectError, withError } from "@/lib/action-utils";

async function taskFieldsFrom(homeId: string, form: FormData) {
  const applianceId = str(form, "applianceId") || null;

  if (applianceId) {
    const appliance = await prisma.appliance.findUnique({
      where: { id: applianceId },
      select: { homeId: true },
    });
    if (!appliance || appliance.homeId !== homeId) {
      throw new AccessError("That appliance isn't part of this home.");
    }
  }

  const intervalValue = Number.parseInt(str(form, "intervalValue"), 10);
  if (!Number.isFinite(intervalValue) || intervalValue < 1) {
    throw new Error("How often must be a whole number of at least 1.");
  }

  return {
    applianceId,
    title: requireText(form, "title", "Task"),
    notes: optionalStr(form, "notes"),
    intervalValue,
    intervalUnit: enumValue(
      form,
      "intervalUnit",
      RecurrenceUnit,
      RecurrenceUnit.MONTH,
    ),
    nextDueOn: requiredDate(form, "nextDueOn"),
    active: str(form, "active") !== "false",
  };
}

export async function createTask(homeId: string, form: FormData) {
  const returnTo = `/homes/${homeId}/maintenance`;
  try {
    await requireHome(homeId, HomeRole.MEMBER);
    await prisma.maintenanceTask.create({
      data: { homeId, ...(await taskFieldsFrom(homeId, form)) },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(returnTo, error));
  }

  revalidatePath(returnTo);
  redirect(returnTo);
}

async function taskInHome(homeId: string, taskId: string) {
  const task = await prisma.maintenanceTask.findUnique({
    where: { id: taskId },
  });
  if (!task || task.homeId !== homeId) {
    throw new AccessError("Routine task not found.");
  }
  return task;
}

export async function updateTask(
  homeId: string,
  taskId: string,
  form: FormData,
) {
  try {
    await requireHome(homeId, HomeRole.MEMBER);
    await taskInHome(homeId, taskId);
    await prisma.maintenanceTask.update({
      where: { id: taskId },
      data: await taskFieldsFrom(homeId, form),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/tasks/${taskId}/edit`, error));
  }

  revalidatePath(`/homes/${homeId}/maintenance`);
  redirect(`/homes/${homeId}/maintenance`);
}

export async function deleteTask(homeId: string, taskId: string) {
  try {
    await requireHome(homeId, HomeRole.ADMIN);
    await taskInHome(homeId, taskId);
    // Past completions stay in the log; their taskId is nulled by the schema.
    await prisma.maintenanceTask.delete({ where: { id: taskId } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/maintenance`, error));
  }

  revalidatePath(`/homes/${homeId}/maintenance`);
  redirect(`/homes/${homeId}/maintenance`);
}

/** Mark a task done from the app. Records the entry and rolls the date forward. */
export async function markTaskComplete(
  homeId: string,
  taskId: string,
  form: FormData,
) {
  const returnTo = `/homes/${homeId}/maintenance`;
  try {
    const { user } = await requireHome(homeId, HomeRole.MEMBER);
    const task = await taskInHome(homeId, taskId);

    // The quick "Done" button posts no date and means today.
    const raw = str(form, "completedOn");
    const completedOn = raw
      ? requiredDate(form, "completedOn")
      : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

    await completeTask(task, {
      completedOn,
      notes: optionalStr(form, "notes"),
      costCents: optionalMoneyCents(form, "cost"),
      vendor: optionalStr(form, "vendor"),
      createdById: user.id,
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(returnTo, error));
  }

  revalidatePath(returnTo);
  redirect(returnTo);
}
