import { NextResponse } from "next/server";
import { DocumentCategory, HomeRole } from "@prisma/client";
import { requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { buildStorageKey, storage } from "@/lib/storage";
import { enumValue, optionalStr, str } from "@/lib/forms";
import { errorMessage } from "@/lib/action-utils";

/**
 * Uploads go through a route handler rather than a server action so the form
 * works as an ordinary multipart POST.
 *
 * The whole file is buffered in memory before it reaches storage, which is why
 * there's a size ceiling here. Raising it much past this wants presigned
 * direct-to-bucket uploads instead.
 */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const form = await request.formData();
  const homeId = str(form, "homeId");
  const back = (message?: string) =>
    NextResponse.redirect(
      new URL(
        `/homes/${homeId}/documents${message ? `?error=${encodeURIComponent(message)}` : ""}`,
        request.url,
      ),
      { status: 303 },
    );

  try {
    const { user } = await requireHome(homeId, HomeRole.MEMBER);

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return back("Choose a file to upload.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return back("That file is larger than the 25 MB upload limit.");
    }

    const storageKey = buildStorageKey(homeId, file.name);
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";

    await storage().put(storageKey, bytes, contentType);

    await prisma.document.create({
      data: {
        homeId,
        title: str(form, "title") || file.name,
        category: enumValue(
          form,
          "category",
          DocumentCategory,
          DocumentCategory.OTHER,
        ),
        description: optionalStr(form, "description"),
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
        storageKey,
        uploadedById: user.id,
      },
    });

    return back();
  } catch (error) {
    return back(errorMessage(error));
  }
}
