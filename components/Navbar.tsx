"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Waves } from "lucide-react";
import type { Profile } from "@/lib/types";
import { roleLabels } from "@/lib/types";
import { getRoleTone } from "@/lib/badgeTones";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  canViewAnnouncements,
  canViewMembers,
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
    ...(canViewMembers(profile)
      ? [{ href: "/admin/members", label: "社員名單" }]
      : []),
  ];

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-semibold text-text-primary"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Waves size={18} strokeWidth={2} />
            </span>
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
                  className={`flex min-h-11 items-center rounded-xl px-3 py-2 font-medium transition-colors ${
                    isActive
                      ? "bg-primary-light text-primary"
                      : "text-text-secondary hover:bg-appBg hover:text-text-primary"
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
                <p className="font-medium text-text-primary">
                  {profile?.full_name || user.email}
                </p>
                <p className="mt-0.5">
                  {profile ? (
                    <Badge tone={getRoleTone(profile.role)}>
                      {roleLabels[profile.role]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-text-secondary">
                      讀取身份中
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => void onLogout()}
                disabled={isLoading}
              >
                登出
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              onClick={() => void onLogin()}
              disabled={isLoading}
            >
              Google 登入
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
