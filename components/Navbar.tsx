"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import { roleLabels } from "@/lib/types";
import {
  canManageMemberRoles,
  canViewAnnouncements,
  canViewRentals,
} from "@/lib/permissions";

type NavbarProps = {
  user: User | null;
  profile: Profile | null;
  isLoading?: boolean;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
};

const baseLinks = [{ href: "/", label: "首頁" }];

export function Navbar({
  user,
  profile,
  isLoading = false,
  onLogin,
  onLogout,
}: NavbarProps) {
  const pathname = usePathname();
  const links = [
    ...baseLinks,
    ...(user ? [{ href: "/profile", label: "基本資料" }] : []),
    ...(canViewAnnouncements(profile)
      ? [{ href: "/announcements", label: "公告" }]
      : []),
    ...(canViewRentals(profile) ? [{ href: "/rentals", label: "租板" }] : []),
    ...(canManageMemberRoles(profile)
      ? [{ href: "/admin/members", label: "社員管理" }]
      : []),
  ];

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-base font-semibold text-slate-950">
            西灣衝浪社
          </Link>

          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {links.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 font-medium ${
                    isActive
                      ? "text-blue-700"
                      : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <div className="hidden text-right sm:block">
                <p className="font-medium text-slate-900">
                  {profile?.full_name || user.email}
                </p>
                <p className="text-xs text-slate-500">
                  {profile ? roleLabels[profile.role] : "讀取身份中"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onLogout()}
                className="border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={isLoading}
              >
                登出
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void onLogin()}
              className="bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isLoading}
            >
              Google 登入
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
