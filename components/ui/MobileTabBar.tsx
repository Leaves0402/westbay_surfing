"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Megaphone, User, Users, Waves } from "lucide-react";

type TabItem = {
  href: string;
  label: string;
  icon: typeof Home;
  disabled?: boolean;
};

const tabs: TabItem[] = [
  { href: "/", label: "首頁", icon: Home },
  { href: "/announcements", label: "公告", icon: Megaphone },
  { href: "/rentals", label: "租板", icon: Waves },
  { href: "/rentals", label: "揪衝", icon: Users, disabled: true },
  { href: "/profile", label: "我的", icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主要導覽"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const isActive =
            !tab.disabled &&
            (pathname === tab.href ||
              (tab.href !== "/" && pathname.startsWith(tab.href)));
          const Icon = tab.icon;

          return (
            <li key={`${tab.href}-${tab.label}`}>
              {tab.disabled ? (
                <span
                  aria-disabled="true"
                  className="flex min-h-11 flex-col items-center justify-center gap-1 py-2 text-slate-300"
                >
                  <Icon size={20} strokeWidth={1.75} />
                  <span className="text-[11px] font-medium">{tab.label}</span>
                </span>
              ) : (
                <Link
                  href={tab.href}
                  className={`flex min-h-11 flex-col items-center justify-center gap-1 py-2 ${
                    isActive ? "text-primary" : "text-slate-500"
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                  <span className="text-[11px] font-medium">{tab.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
