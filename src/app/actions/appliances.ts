"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApplianceCategory, HomeRole } from "@prisma/client";
import { AccessError, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  enumValue,
  optionalDate,
  optionalInt,
  optionalStr,
  requireText,
} from "@/lib/forms";
import { isRedirectError, withError } from "@/lib/action-utils";

function applianceFieldsFrom(form: FormData) {
  return {
    name: requireText(form, "name", "Name"),
    category: enumValue(
      form,
      "category",
      ApplianceCategory,
      ApplianceCategory.OTHER,
    ),
    brand: optionalStr(form, "brand"),
    modelNumber: optionalStr(form, "modelNumber"),
    serialNumber: optionalStr(form, "serialNumber"),
    location: optionalStr(form, "location"),
    installedOn: optionalDate(form, "installedOn"),
    modelYear: optionalInt(form, "modelYear"),
    warrantyExpiresOn: optionalDate(form, "warrantyExpiresOn"),
    expectedLifeLowYears: optionalInt(form, "expectedLifeLowYears"),
    expectedLifeHighYears: optionalInt(form, "expectedLifeHighYears"),
    notes: optionalStr(form, "notes"),
  };
}

/**
 * Confirm the appliance really belongs to the home named in the URL before
 * writing to it, so a swapped id can't reach another home's records.
 */
async function assertApplianceInHome(
  homeId: string,
  applianceId: string,
  minimum: HomeRole,
) {
  await requireHome(homeId, minimum);
  const appliance = await prisma.appliance.findUnique({
    where: { id: applianceId },
    select: { id: true, homeId: true },
  });
  if (!appliance || appliance.homeId !== homeId) {
    throw new AccessError("Appliance not found.");
  }
}

export async function createAppliance(homeId: string, form: FormData) {
  let applianceId: string;
  try {
    await requireHome(homeId, HomeRole.MEMBER);
    const appliance = await prisma.appliance.create({
      data: { homeId, ...applianceFieldsFrom(form) },
    });
    applianceId = appliance.id;
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/appliances/new`, error));
  }

  revalidatePath(`/homes/${homeId}`);
  redirect(`/homes/${homeId}/appliances/${applianceId}`);
}

export async function updateAppliance(
  homeId: string,
  applianceId: string,
  form: FormData,
) {
  try {
    await assertApplianceInHome(homeId, applianceId, HomeRole.MEMBER);
    await prisma.appliance.update({
      where: { id: applianceId },
      data: applianceFieldsFrom(form),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/appliances/${applianceId}/edit`, error));
  }

  revalidatePath(`/homes/${homeId}`);
  redirect(`/homes/${homeId}/appliances/${applianceId}`);
}

export async function deleteAppliance(homeId: string, applianceId: string) {
  try {
    await assertApplianceInHome(homeId, applianceId, HomeRole.ADMIN);
    // Maintenance entries survive: their applianceId is nulled by the schema's
    // SetNull rule, so the home's work history stays intact after a swap-out.
    await prisma.appliance.delete({ where: { id: applianceId } });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/appliances/${applianceId}`, error));
  }

  revalidatePath(`/homes/${homeId}`);
  redirect(`/homes/${homeId}/appliances`);
}
