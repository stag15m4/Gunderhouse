import { notFound } from "next/navigation";
import { HomeRole } from "@prisma/client";
import { deleteAppliance, updateAppliance } from "@/app/actions/appliances";
import { canAdminister, requireHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { ApplianceForm } from "@/components/ApplianceForm";
import { FormError, PageHeader, Section } from "@/components/ui";

export default async function EditAppliancePage({
  params,
  searchParams,
}: {
  params: Promise<{ homeId: string; applianceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { homeId, applianceId } = await params;
  const { error } = await searchParams;
  const { home, role } = await requireHome(homeId, HomeRole.MEMBER);

  const appliance = await prisma.appliance.findUnique({
    where: { id: applianceId },
  });
  if (!appliance || appliance.homeId !== homeId) notFound();

  const update = updateAppliance.bind(null, homeId, applianceId);
  const remove = deleteAppliance.bind(null, homeId, applianceId);

  return (
    <>
      <PageHeader
        title={`Edit ${appliance.name}`}
        subtitle={home.name}
        backHref={`/homes/${homeId}/appliances/${applianceId}`}
        backLabel={appliance.name}
      />
      <FormError message={error} />
      <ApplianceForm
        action={update}
        appliance={appliance}
        submitLabel="Save changes"
      />

      {canAdminister(role) ? (
        <Section
          title="Delete"
          description="Maintenance entries logged against this item stay in the home's log."
        >
          <form action={remove}>
            <button className="btn-danger" type="submit">
              Delete {appliance.name}
            </button>
          </form>
        </Section>
      ) : null}
    </>
  );
}
