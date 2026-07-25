"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { HomeRole } from "@prisma/client";
import { AccessError, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  optionalMoneyCents,
  optionalStr,
  requiredDate,
  requireText,
  str,
} from "@/lib/forms";
import { isRedirectError, withError } from "@/lib/action-utils";

/**
 * An entry may be tied to an appliance or left at the home level (roof work,
 * landscaping, a general repair). A blank applianceId means home-level.
 */
async function entryFieldsFrom(homeId: string, form: FormData) {
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

  return {
    applianceId,
    performedOn: requiredDate(form, "performedOn"),
    description: requireText(form, "description", "Description"),
    costCents: optionalMoneyCents(form, "cost"),
    vendor: optionalStr(form, "vendor"),
    notes: optionalStr(form, "notes"),
  };
}

export async function createMaintenanceEntry(homeId: string, form: FormData) {
  const returnTo = str(form, "returnTo") || `/homes/${homeId}/maintenance`;

  try {
    const { user } = await requireHome(homeId, HomeRole.MEMBER);
    await prisma.maintenanceEntry.create({
      data: {
        homeId,
        createdById: user.id,
        ...(await entryFieldsFrom(homeId, form)),
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(returnTo, error));
  }

  revalidatePath(`/homes/${homeId}`);
  redirect(returnTo);
}

export async function updateMaintenanceEntry(
  homeId: string,
  entryId: string,
  form: FormData,
) {
  try {
    await requireHome(homeId, HomeRole.MEMBER);
    const existing = await prisma.maintenanceEntry.findUnique({
      where: { id: entryId },
      select: { homeId: true },
    });
    if (!existing || existing.homeId !== homeId) {
      throw new AccessError("Maintenance entry not found.");
    }

    await prisma.maintenanceEntry.update({
      where: { id: entryId },
      data: await entryFieldsFrom(homeId, form),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/maintenance/${entryId}/edit`, error));
  }

  revalidatePath(`/homes/${homeId}`);
  redirect(`/homes/${homeId}/maintenance`);
}

export async function deleteMaintenanceEntry(homeId: string, entryId: string) {
  try {
    await requireHome(homeId, HomeRole.ADMIN);
    const existing = await prisma.maintenanceEntry.findUnique({
      where: { id: entryId },
      select: { homeId: true },
    });
    if (!existing || existing.homeId !== homeId) {
      throw new AccessError("Maintenance entry not found.");
    }
    await prisma.maintenanceEntry.delete({ where: { id: entryId } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/maintenance`, error));
  }

  revalidatePath(`/homes/${homeId}`);
  redirect(`/homes/${homeId}/maintenance`);
}
