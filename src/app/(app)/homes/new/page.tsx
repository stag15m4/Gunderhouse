import { createHome } from "@/app/actions/homes";
import { requireOwner } from "@/lib/access";
import { HomeForm } from "@/components/HomeForm";
import { FormError, PageHeader } from "@/components/ui";

export default async function NewHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireOwner();
  const { error } = await searchParams;

  return (
    <>
      <PageHeader title="Add a home" backHref="/homes" backLabel="Homes" />
      <FormError message={error} />
      <HomeForm action={createHome} submitLabel="Add home" />
    </>
  );
}
