"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Section switcher within a single home. Horizontally scrollable so it never
 * wraps or squeezes on a phone.
 */
export function HomeTabs({
  tabs,
}: {
  tabs: Array<{ href: string; label: string }>;
}) {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 mb-1 overflow-x-auto px-4">
      <div className="flex min-w-max gap-1 border-b border-[var(--border)] pb-2">
        {tabs.map((tab) => {
          // The overview tab is the home root, so it must match exactly or it
          // would light up on every sub-page.
          const active =
            pathname === tab.href ||
            (tab.href.split("/").length > 3 &&
              pathname.startsWith(`${tab.href}/`));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
