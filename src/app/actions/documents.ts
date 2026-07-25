"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DocumentCategory, HomeRole } from "@prisma/client";
import { AccessError, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { enumValue, optionalStr, requireText } from "@/lib/forms";
import { storage } from "@/lib/storage";
import { isRedirectError, withError } from "@/lib/action-utils";

export async function updateDocument(
  homeId: string,
  documentId: string,
  form: FormData,
) {
  try {
    await requireHome(homeId, HomeRole.MEMBER);
    const existing = await prisma.document.findUnique({
      where: { id: documentId },
      select: { homeId: true },
    });
    if (!existing || existing.homeId !== homeId) {
      throw new AccessError("Document not found.");
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        title: requireText(form, "title", "Title"),
        category: enumValue(
          form,
          "category",
          DocumentCategory,
          DocumentCategory.OTHER,
        ),
        description: optionalStr(form, "description"),
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/documents`, error));
  }

  revalidatePath(`/homes/${homeId}/documents`);
  redirect(`/homes/${homeId}/documents`);
}

/** Removes the database record and the stored file. */
export async function deleteDocument(homeId: string, documentId: string) {
  try {
    await requireHome(homeId, HomeRole.ADMIN);
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { homeId: true, storageKey: true },
    });
    if (!document || document.homeId !== homeId) {
      throw new AccessError("Document not found.");
    }

    await prisma.document.delete({ where: { id: documentId } });
    // The record is the source of truth; a failed object delete leaves an
    // orphaned file but must not fail the request.
    await storage()
      .delete(document.storageKey)
      .catch(() => undefined);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    redirect(withError(`/homes/${homeId}/documents`, error));
  }

  revalidatePath(`/homes/${homeId}/documents`);
  redirect(`/homes/${homeId}/documents`);
}
