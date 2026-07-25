"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAccount,
  IconForecast,
  IconHome,
  IconHousehold,
} from "@/components/icons";

const ICONS = {
  home: IconHome,
  forecast: IconForecast,
  household: IconHousehold,
  account: IconAccount,
} as const;

export type TabKey = keyof typeof ICONS;

export function TabBar({
  tabs,
}: {
  tabs: Array<{ href: string; label: string; icon: TabKey }>;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--sidebar)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2">
        {tabs.map(({ href, label, icon }) => {
          const Icon = ICONS[icon];
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors ${
                active
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              <Icon />
              <span className="text-[11px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
