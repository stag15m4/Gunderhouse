import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { requireUser } from "@/lib/access";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link href="/homes" className="text-lg font-semibold text-stone-900">
            Gunderhouse
          </Link>
          <nav className="flex flex-1 flex-wrap gap-4 text-sm text-stone-600">
            <Link className="hover:text-stone-900" href="/homes">
              Homes
            </Link>
            <Link className="hover:text-stone-900" href="/forecast">
              Forecast
            </Link>
            {user.systemRole === "OWNER" ? (
              <Link className="hover:text-stone-900" href="/household">
                Household
              </Link>
            ) : null}
          </nav>
          <div className="flex items-center gap-3 text-sm text-stone-500">
            <Link className="hover:text-stone-900" href="/account">
              {user.name || user.email}
            </Link>
            <form action={signOutAction}>
              <button className="hover:text-stone-900" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
