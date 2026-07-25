import { canAdminister, canEdit, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { deleteDocument } from "@/app/actions/documents";
import { formatBytes, formatDate } from "@/lib/format";
import { DOCUMENT_CATEGORY_LABELS, enumOptions } from "@/lib/labels";
import {
  Empty,
  Field,
  FormError,
  PageHeader,
  SelectField,
  Section,
} from "@/components/ui";

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { homeId } = await params;
  const { error } = await searchParams;
  const { home, role } = await requireHome(homeId);

  const documents = await prisma.document.findMany({
    where: { homeId },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    include: { uploadedBy: { select: { name: true } } },
  });

  const grouped = new Map<string, typeof documents>();
  for (const doc of documents) {
    const list = grouped.get(doc.category) ?? [];
    list.push(doc);
    grouped.set(doc.category, list);
  }

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle={`${home.name} · ${documents.length} files`}
        backHref={`/homes/${homeId}`}
        backLabel={home.name}
      />

      <FormError message={error} />

      {canEdit(role) ? (
        <Section title="Upload" description="Up to 25 MB per file.">
          <form
            action="/api/documents/upload"
            method="post"
            encType="multipart/form-data"
            className="space-y-4"
          >
            <input type="hidden" name="homeId" value={homeId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Title"
                name="title"
                placeholder="Homeowners policy 2026"
              />
              <SelectField
                label="Category"
                name="category"
                options={enumOptions(DOCUMENT_CATEGORY_LABELS)}
                defaultValue="OTHER"
              />
            </div>
            <Field label="Description" name="description" />
            <div>
              <label className="label" htmlFor="file">
                File <span className="text-red-400">*</span>
              </label>
              <input
                className="mt-1 block w-full text-sm text-[var(--muted)] file:mr-3 file:rounded-md
                           file:border-0 file:bg-[var(--btn)] file:px-3 file:py-2 file:text-sm
                           file:text-white hover:file:bg-[var(--btn)]"
                id="file"
                name="file"
                type="file"
                required
              />
            </div>
            <button className="btn" type="submit">
              Upload
            </button>
          </form>
        </Section>
      ) : null}

      {documents.length === 0 ? (
        <div className="card p-4">
          <Empty>No documents yet.</Empty>
        </div>
      ) : (
        [...grouped.entries()].map(([category, docs]) => (
          <Section
            key={category}
            title={
              DOCUMENT_CATEGORY_LABELS[
                category as keyof typeof DOCUMENT_CATEGORY_LABELS
              ]
            }
          >
            <div className="overflow-x-auto">
            <table className="table min-w-[36rem]">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>File</th>
                  <th>Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <a
                        className="font-medium text-[var(--text)] hover:underline"
                        href={`/api/documents/${doc.id}`}
                      >
                        {doc.title}
                      </a>
                      {doc.description ? (
                        <div className="text-xs text-[var(--subtle)]">
                          {doc.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="text-xs text-[var(--subtle)]">
                      {doc.fileName}
                      <div>{formatBytes(doc.sizeBytes)}</div>
                    </td>
                    <td className="whitespace-nowrap text-xs text-[var(--subtle)]">
                      {formatDate(doc.createdAt)}
                      {doc.uploadedBy ? <div>by {doc.uploadedBy.name}</div> : null}
                    </td>
                    <td className="text-right">
                      {canAdminister(role) ? (
                        <form action={deleteDocument.bind(null, homeId, doc.id)}>
                          <button
                            className="text-xs text-red-400 hover:text-red-300"
                            type="submit"
                          >
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </Section>
        ))
      )}
    </>
  );
}
