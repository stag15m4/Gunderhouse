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

function projectFieldsFrom(form: FormData) {
  const estimatedCostCents = optionalMoneyCents(form, "estimatedCost");
  if (estimatedCostCents === null) {
    throw new Error("An estimated cost is required — that's the point of it.");
  }
  if (estimatedCostCents < 0) {
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
  try {
    const homeId = requireText(form, "homeId", "Home");
    const { user } = await requireHome(homeId, HomeRole.MEMBER);
    await prisma.project.create({
      data: { homeId, createdById: user.id, ...projectFieldsFrom(form) },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError("/forecast", error));
  }

  revalidatePath("/forecast");
  redirect("/forecast");
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
  redirect("/forecast");
}

/**
 * Mark a project done. The actual cost is optional — it's often not known the
 * day the work finishes — and the estimate is kept either way, so you can see
 * afterwards how close the forecast was.
 */
export async function completeProject(projectId: string, form: FormData) {
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
    redirect(withError("/forecast", error));
  }

  revalidatePath("/forecast");
  redirect("/forecast");
}

export async function reopenProject(projectId: string) {
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
    redirect(withError("/forecast", error));
  }

  revalidatePath("/forecast");
  redirect("/forecast");
}

export async function deleteProject(projectId: string) {
  try {
    await projectForWrite(projectId, HomeRole.ADMIN);
    await prisma.project.delete({ where: { id: projectId } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError("/forecast", error));
  }

  revalidatePath("/forecast");
  redirect("/forecast");
}
