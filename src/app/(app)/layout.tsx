import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { requireUser } from "@/lib/access";
import { budgetAccessFor } from "@/lib/budget-access";
import { Wordmark } from "@/components/Wordmark";
import { TabBar } from "@/components/TabBar";
import { IconSignOut } from "@/components/icons";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const tabs = [
    { href: "/homes", label: "Homes", icon: "home" as const },
    { href: "/forecast", label: "Forecast", icon: "forecast" as const },
    // Hidden entirely when someone has no budget access: an empty tab telling
    // them there's money they can't see is worse than no tab.
    ...(budgetAccessFor(user).canView
      ? [{ href: "/budget", label: "Budget", icon: "budget" as const }]
      : []),
    // "People" rather than "Household": with a household budget in the nav,
    // "Household" no longer reads as the page about who has access.
    ...(user.systemRole === "OWNER"
      ? [{ href: "/household", label: "People", icon: "household" as const }]
      : []),
    { href: "/account", label: "Account", icon: "account" as const },
  ];

  return (
    <div className="min-h-screen">
      {/*
        The top-left corner is intentionally empty: on an installed PWA the
        window controls sit there and would cover anything placed in it. The
        wordmark is centred and the only control is pinned right.
      */}
      <header
        className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <div className="w-10" aria-hidden="true" />
          <div className="flex flex-1 justify-center">
            <Link href="/homes" aria-label="Gunderhouse">
              <Wordmark />
            </Link>
          </div>
          <form action={signOutAction} className="flex w-10 justify-end">
            <button
              className="text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              type="submit"
              title="Sign out"
              aria-label="Sign out"
            >
              <IconSignOut />
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-28 pt-5">
        {children}
      </main>

      <TabBar tabs={tabs} />
    </div>
  );
}
