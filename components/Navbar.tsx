"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Menu, Waves } from "lucide-react";
import { AppDrawer } from "@/components/navigation/AppDrawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getRoleTone } from "@/lib/badgeTones";
import { canUseMemberFeatures } from "@/lib/permissions";
import { needsProfileCompletion } from "@/lib/profileCompletion";
import type { Profile } from "@/lib/types";
import { roleLabels } from "@/lib/types";
import { useNavigationBadges } from "@/lib/useNavigationBadges";

type NavbarProps = {
  user: User | null;
  profile: Profile | null;
  isLoading?: boolean;
  onLogin: () => Promise<void> | void;
  onLogout: () => Promise<void> | void;
  /**
   * overlay：疊在首頁 Hero 上，初始透明，捲動離開 Hero 後轉為白色半透明。
   * solid：其他頁面固定白色 Header。
   */
  variant?: "solid" | "overlay";
};

export function Navbar({
  user,
  profile,
  isLoading = false,
  onLogin,
  onLogout,
  variant = "solid",
}: NavbarProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hasScrolledPastHero, setHasScrolledPastHero] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const profileNeedsAttention = needsProfileCompletion(profile);
  const navigationBadges = useNavigationBadges({
    enabled: canUseMemberFeatures(profile),
    userId: user?.id,
  });
  const hasMenuAttention =
    profileNeedsAttention ||
    navigationBadges.announcements ||
    navigationBadges.lessons;

  const isOverlay = variant === "overlay";

  useEffect(() => {
    if (!isOverlay) return;

    const handleScroll = () => {
      // Hero 高度約 78–85svh，超過 70vh 之後就視為離開 Hero。
      setHasScrolledPastHero(window.scrollY > window.innerHeight * 0.7);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isOverlay]);

  const isTransparent = isOverlay && !hasScrolledPastHero;

  const headerClasses = isOverlay
    ? `fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        isTransparent
          ? "bg-transparent"
          : "border-b border-border bg-surface/90 backdrop-blur"
      }`
    : "sticky top-0 z-50 border-b border-line bg-surface";

  const iconButtonClasses = isTransparent
    ? "text-white hover:bg-white/15"
    : "text-slate-600 hover:bg-bg";

  const brandClasses = isTransparent ? "text-white" : "text-text-primary";

  return (
    <>
      <header className={headerClasses}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label={
                hasMenuAttention ? "開啟選單（有待查看項目）" : "開啟選單"
              }
              aria-expanded={isDrawerOpen}
              aria-controls="app-drawer"
              title="開啟選單"
              onClick={() => setIsDrawerOpen(true)}
              className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${iconButtonClasses}`}
            >
              <Menu size={22} strokeWidth={2} />
              {hasMenuAttention && (
                <span
                  aria-hidden="true"
                  className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
                />
              )}
            </button>

            <Link
              href="/"
              className={`flex min-w-0 items-center gap-2 text-base font-semibold ${brandClasses}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  isTransparent
                    ? "bg-white/20 text-white"
                    : "bg-primary-light text-primary"
                }`}
              >
                <Waves size={18} strokeWidth={2} />
              </span>
              <span className="truncate">西灣衝浪社</span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm">
            {user ? (
              <>
                {profile && (
                  <span className="sm:hidden">
                    <Badge tone={getRoleTone(profile.role)}>
                      {roleLabels[profile.role]}
                    </Badge>
                  </span>
                )}
                <div className="hidden text-right sm:block">
                  <p
                    className={`max-w-[180px] truncate font-medium ${
                      isTransparent ? "text-white" : "text-text-primary"
                    }`}
                  >
                    {profile?.full_name || user.email}
                  </p>
                  {profile && (
                    <p className="mt-0.5">
                      <Badge tone={getRoleTone(profile.role)}>
                        {roleLabels[profile.role]}
                      </Badge>
                    </p>
                  )}
                </div>
                <Button
                  variant={isTransparent ? "primary" : "outline"}
                  className={`hidden sm:inline-flex ${
                    isTransparent
                      ? "!bg-white/20 !text-white hover:!bg-white/30"
                      : ""
                  }`}
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

      <AppDrawer
        isOpen={isDrawerOpen}
        user={user}
        profile={profile}
        isLoading={isLoading}
        onClose={() => setIsDrawerOpen(false)}
        onLogin={() => void onLogin()}
        onLogout={() => void onLogout()}
        triggerRef={menuButtonRef}
        profileNeedsAttention={profileNeedsAttention}
        navigationBadges={navigationBadges}
      />
    </>
  );
}
