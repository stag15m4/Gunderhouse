"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { HomeRole, ProjectStatus } from "@prisma/client";
import { AccessError, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  optionalDate,
  optionalMoneyCents,
  optionalStr,
  requireText,
  str,
} from "@/lib/forms";
import { isRedirectError, withError } from "@/lib/action-utils";

/**
 * Where to go once the write lands. Projects are reachable from the forecast
 * and from a home's page, and you should end up back where you started.
 * Anything that isn't a plain in-app path falls back to the forecast, so this
 * can't be turned into an open redirect.
 */
function returnTo(form: FormData): string {
  const raw = str(form, "returnTo");
  return /^\/[A-Za-z0-9/_-]*$/.test(raw) ? raw : "/forecast";
}

function projectFieldsFrom(form: FormData) {
  // The cost is optional so something can be written down before it's priced.
  // Unpriced projects show in the list and stay out of the forecast totals.
  const estimatedCostCents = optionalMoneyCents(form, "estimatedCost");
  if (estimatedCostCents !== null && estimatedCostCents < 0) {
    throw new Error("Estimated cost can't be negative.");
  }

  return {
    title: requireText(form, "title", "Project"),
    notes: optionalStr(form, "notes"),
    estimatedCostCents,
    targetOn: optionalDate(form, "targetOn"),
  };
}

/**
 * Projects are created from the forecast, which spans every home, so the home
 * is picked in the form rather than taken from the URL.
 */
export async function createProject(form: FormData) {
  const back = returnTo(form);
  try {
    const homeId = requireText(form, "homeId", "Home");
    const { user } = await requireHome(homeId, HomeRole.MEMBER);
    await prisma.project.create({
      data: { homeId, createdById: user.id, ...projectFieldsFrom(form) },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/forecast");
  revalidatePath(back);
  redirect(back);
}

async function projectForWrite(projectId: string, minimum: HomeRole) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, homeId: true },
  });
  if (!project) throw new AccessError("Project not found.");
  await requireHome(project.homeId, minimum);
  return project;
}

export async function updateProject(projectId: string, form: FormData) {
  const back = returnTo(form);
  try {
    await projectForWrite(projectId, HomeRole.MEMBER);
    await prisma.project.update({
      where: { id: projectId },
      data: projectFieldsFrom(form),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/projects/${projectId}`, error));
  }

  revalidatePath("/forecast");
  revalidatePath(back);
  redirect(back);
}

/**
 * Mark a project done. The actual cost is optional — it's often not known the
 * day the work finishes — and the estimate is kept either way, so you can see
 * afterwards how close the forecast was.
 */
export async function completeProject(projectId: string, form: FormData) {
  const back = returnTo(form);
  try {
    await projectForWrite(projectId, HomeRole.MEMBER);
    const raw = str(form, "completedOn");
    const completedOn = raw
      ? optionalDate(form, "completedOn")
      : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.DONE,
        completedOn,
        actualCostCents: optionalMoneyCents(form, "actualCost"),
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/forecast");
  revalidatePath(back);
  redirect(back);
}

export async function reopenProject(projectId: string, form: FormData) {
  const back = returnTo(form);
  try {
    await projectForWrite(projectId, HomeRole.MEMBER);
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.PLANNED,
        completedOn: null,
        actualCostCents: null,
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/forecast");
  revalidatePath(back);
  redirect(back);
}

export async function deleteProject(projectId: string, form: FormData) {
  const back = returnTo(form);
  try {
    await projectForWrite(projectId, HomeRole.ADMIN);
    await prisma.project.delete({ where: { id: projectId } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(back, error));
  }

  revalidatePath("/forecast");
  revalidatePath(back);
  redirect(back);
}
