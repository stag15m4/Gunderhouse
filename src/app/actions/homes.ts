"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { HomeRole, HomeType } from "@prisma/client";
import { requireHome, requireOwner } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  enumValue,
  optionalDate,
  optionalInt,
  optionalStr,
  requireText,
} from "@/lib/forms";
import { isRedirectError, withError } from "@/lib/action-utils";

function homeFieldsFrom(form: FormData) {
  return {
    name: requireText(form, "name", "Name"),
    type: enumValue(form, "type", HomeType, HomeType.PRIMARY_RESIDENCE),
    addressLine1: optionalStr(form, "addressLine1"),
    addressLine2: optionalStr(form, "addressLine2"),
    city: optionalStr(form, "city"),
    state: optionalStr(form, "state"),
    postalCode: optionalStr(form, "postalCode"),
    yearBuilt: optionalInt(form, "yearBuilt"),
    squareFeet: optionalInt(form, "squareFeet"),
    purchasedOn: optionalDate(form, "purchasedOn"),
    notes: optionalStr(form, "notes"),
  };
}

export async function createHome(form: FormData) {
  let homeId: string;
  try {
    await requireOwner();
    const home = await prisma.home.create({ data: homeFieldsFrom(form) });
    homeId = home.id;
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError("/homes/new", error));
  }

  revalidatePath("/homes");
  redirect(`/homes/${homeId}`);
}

export async function updateHome(homeId: string, form: FormData) {
  try {
    await requireHome(homeId, HomeRole.ADMIN);
    await prisma.home.update({
      where: { id: homeId },
      data: homeFieldsFrom(form),
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/edit`, error));
  }

  revalidatePath(`/homes/${homeId}`);
  revalidatePath("/homes");
  redirect(`/homes/${homeId}`);
}

/**
 * Deleting a home takes its appliances, maintenance log, and document records
 * with it (see the cascade rules in schema.prisma). Stored files are removed
 * too, so this is not recoverable from the app.
 */
export async function deleteHome(homeId: string) {
  try {
    await requireOwner();
    const documents = await prisma.document.findMany({
      where: { homeId },
      select: { storageKey: true },
    });

    await prisma.home.delete({ where: { id: homeId } });

    if (documents.length) {
      const { storage } = await import("@/lib/storage");
      const driver = storage();
      await Promise.allSettled(
        documents.map((doc) => driver.delete(doc.storageKey)),
      );
    }
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}`, error));
  }

  revalidatePath("/homes");
  redirect("/homes");
}
