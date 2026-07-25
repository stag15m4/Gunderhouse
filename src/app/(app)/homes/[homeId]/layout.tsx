import Link from "next/link";
import { requireHome, canAdminister } from "@/lib/access";

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
    { href: `/homes/${homeId}/appliances`, label: "Appliances & systems" },
    { href: `/homes/${homeId}/maintenance`, label: "Maintenance log" },
    { href: `/homes/${homeId}/documents`, label: "Documents" },
    ...(canAdminister(role)
      ? [{ href: `/homes/${homeId}/access`, label: "Access" }]
      : []),
  ];

  return (
    <>
      <nav className="mb-6 flex flex-wrap gap-x-5 gap-y-1 border-b border-stone-200 pb-3 text-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="text-stone-600 hover:text-stone-900"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
