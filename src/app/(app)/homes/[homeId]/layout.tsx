import { requireHome, canAdminister } from "@/lib/access";
import { HomeTabs } from "@/components/HomeTabs";

export default async function HomeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;
  const { role } = await requireHome(homeId);

  const tabs = [
    { href: `/homes/${homeId}`, label: "Overview" },
    { href: `/homes/${homeId}/appliances`, label: "Appliances" },
    { href: `/homes/${homeId}/maintenance`, label: "Maintenance" },
    { href: `/homes/${homeId}/documents`, label: "Documents" },
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
