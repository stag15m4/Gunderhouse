import { HomeRole } from "@prisma/client";
import { deleteHome, updateHome } from "@/app/actions/homes";
import { requireHome } from "@/lib/access";
import { HomeForm } from "@/components/HomeForm";
import { FormError, PageHeader, Section } from "@/components/ui";

export default async function EditHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { homeId } = await params;
  const { error } = await searchParams;
  const { home, user } = await requireHome(homeId, HomeRole.ADMIN);

  const update = updateHome.bind(null, homeId);
  const remove = deleteHome.bind(null, homeId);

  return (
    <>
      <PageHeader
        title={`Edit ${home.name}`}
        backHref={`/homes/${homeId}`}
        backLabel={home.name}
      />
      <FormError message={error} />
      <HomeForm action={update} home={home} submitLabel="Save changes" />

      {user.systemRole === "OWNER" ? (
        <Section
          title="Delete home"
          description="Removes the home along with its appliances, maintenance log, and documents. This can't be undone."
        >
          <form action={remove}>
            <button className="btn-danger" type="submit">
              Delete {home.name}
            </button>
          </form>
        </Section>
      ) : null}
    </>
  );
}
