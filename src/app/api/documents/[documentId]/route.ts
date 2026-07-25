import { NextResponse } from "next/server";
import { requireUser, roleForHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";

/**
 * Download a document. Access is checked against the caller's role on the
 * document's home — the storage key is never exposed to the browser.
 *
 * When the driver can mint a short-lived signed URL, we redirect to it so the
 * bytes come straight from the bucket. Otherwise we stream them ourselves.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const user = await requireUser();

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const role = await roleForHome(user, document.homeId);
  if (!role) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const driver = storage();
  const signed = await driver.signedUrl(document.storageKey, document.fileName);
  if (signed) return NextResponse.redirect(signed);

  const bytes = await driver.get(document.storageKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${document.fileName.replace(/"/g, "")}"`,
    },
  });
}
