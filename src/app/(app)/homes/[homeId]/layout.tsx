import { requireHome, canAdminister } from "@/lib/access";
import { budgetAccessFor } from "@/lib/budget-access";
import { HomeTabs } from "@/components/HomeTabs";

export default async function HomeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const { role, user } = await requireHome(homeId);

  const tabs = [
    { href: `/homes/${homeId}`, label: "Overview" },
    { href: `/homes/${homeId}/appliances`, label: "Appliances" },
    { href: `/homes/${homeId}/maintenance`, label: "Maintenance" },
    { href: `/homes/${homeId}/documents`, label: "Documents" },
    // What a house is worth and what's owed on it is financial, so it follows
    // budget access rather than home access.
    ...(budgetAccessFor(user).canView
      ? [{ href: `/homes/${homeId}/finance`, label: "Value" }]
      : []),
    ...(canAdminister(role)
      ? [{ href: `/homes/${homeId}/access`, label: "Access" }]
      : []),
  ];

  return (
    <>
      <HomeTabs tabs={tabs} />
      {children}
    </>
  );
}
