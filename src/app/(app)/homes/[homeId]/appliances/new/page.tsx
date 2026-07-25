import { HomeRole } from "@prisma/client";
import { createAppliance } from "@/app/actions/appliances";
import { requireHome } from "@/lib/access";
import { ApplianceForm } from "@/components/ApplianceForm";
import { FormError, PageHeader } from "@/components/ui";

export default async function NewAppliancePage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { homeId } = await params;
  const { error } = await searchParams;
  const { home } = await requireHome(homeId, HomeRole.MEMBER);

  const create = createAppliance.bind(null, homeId);

  return (
    <>
      <PageHeader
        title="Add appliance or system"
        subtitle={home.name}
        backHref={`/homes/${homeId}/appliances`}
        backLabel="Appliances & systems"
      />
      <FormError message={error} />
      <ApplianceForm action={create} submitLabel="Add" />
    </>
  );
}
