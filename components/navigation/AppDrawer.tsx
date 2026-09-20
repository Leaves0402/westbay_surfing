"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Home,
  LogOut,
  Mail,
  Megaphone,
  UserRound,
  Users,
  Waves,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getRoleTone } from "@/lib/badgeTones";
import {
  canViewAnnouncements,
  canViewAttendancePage,
  canViewLessons,
  canViewMaintenancePage,
  canViewMembers,
  canViewSurfTrips,
} from "@/lib/permissions";
import type { Profile } from "@/lib/types";
import { roleLabels } from "@/lib/types";
import type { NavigationBadges } from "@/lib/useNavigationBadges";

type DrawerLink = {
  href: string;
  label: string;
  description: string;
  icon: typeof Home;
  attentionLabel?: string;
};

type DrawerGroup = {
  title: string;
  links: DrawerLink[];
};

export function AppDrawer({
  isOpen,
  user,
  profile,
  isLoading,
  onClose,
  onLogin,
  onLogout,
  triggerRef,
  profileNeedsAttention,
  navigationBadges,
}: {
  isOpen: boolean;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  onClose: () => void;
  onLogin: () => void;
  onLogout: () => void;
  /** 關閉後把焦點移回漢堡按鈕。 */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  profileNeedsAttention: boolean;
  navigationBadges: NavigationBadges;
}) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo<DrawerGroup[]>(() => {
    // 公開功能固定包含首頁與租板；其他項目沿用 lib/permissions.ts 的權限判斷。
    const publicGroup: DrawerGroup = {
      title: "公開功能",
      links: [
        {
          href: "/",
          label: "首頁",
          description: "社團介紹與最新樣貌",
          icon: Home,
        },
        {
          href: "/rentals",
          label: "租板",
          description: user
            ? "查看租板時段並登記"
            : "查看公開租板時段與名額",
          icon: Waves,
        },
      ],
    };

    const memberLinks: DrawerLink[] = [];
    if (user) {
      memberLinks.push({
        href: "/profile",
        label: "基本資料",
        description: "姓名、學號與衝浪程度",
        icon: UserRound,
        attentionLabel: profileNeedsAttention ? "基本資料尚未完成" : undefined,
      });
    }
    if (canViewLessons(profile)) {
      memberLinks.push({
        href: "/lessons",
        label: "社課",
        description: "查看社課、報名與候補",
        icon: BookOpen,
        attentionLabel: navigationBadges.lessons ? "有新社課" : undefined,
      });
    }
    if (canViewAnnouncements(profile)) {
      memberLinks.push({
        href: "/announcements",
        label: "公告",
        description: "社團公告與活動訊息",
        icon: Megaphone,
        attentionLabel: navigationBadges.announcements
          ? "有新公告"
          : undefined,
      });
    }
    if (canViewSurfTrips(profile)) {
      memberLinks.push({
        href: "/trips",
        label: "揪外衝",
        description: "外衝活動、浪點與車隊",
        icon: CalendarCheck,
      });
    }
    if (canViewMembers(profile)) {
      memberLinks.push({
        href: "/admin/members",
        label: "社員名單",
        description: "正式成員與衝浪程度",
        icon: Users,
      });
    }

    const staffLinks: DrawerLink[] = [];
    if (canViewAttendancePage(profile)) {
      staffLinks.push({
        href: "/attendance",
        label: "社課簽到",
        description: "教學與社員出席管理",
        icon: ClipboardList,
      });
    }
    if (canViewMaintenancePage(profile)) {
      staffLinks.push({
        href: "/maintenance",
        label: "系統維護與聯絡",
        description: "架構說明與維護聯絡方式",
        icon: Wrench,
      });
    }

    return [
      publicGroup,
      ...(memberLinks.length > 0
        ? [{ title: "社員功能", links: memberLinks }]
        : []),
      ...(staffLinks.length > 0
        ? [{ title: "幹部管理", links: staffLinks }]
        : []),
    ];
  }, [navigationBadges, profile, profileNeedsAttention, user]);

  // 開啟時鎖定背景捲動。
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // 開啟後把焦點移入 Drawer，關閉時移回漢堡按鈕。
  useEffect(() => {
    if (!isOpen) return;

    const trigger = triggerRef.current;
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      trigger?.focus();
    };
  }, [isOpen, triggerRef]);

  // Esc 關閉，並把 Tab 焦點留在 Drawer 內。
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] md:z-[60]">
      <button
        type="button"
        aria-label="關閉選單"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default animate-[drawer-overlay-in_180ms_ease-out] bg-black/45 motion-reduce:animate-none"
      />

      <div
        ref={panelRef}
        id="app-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="主要選單"
        className="absolute inset-y-0 left-0 flex w-[85vw] max-w-[360px] animate-[drawer-panel-in_220ms_ease-out] flex-col border-r border-border bg-surface shadow-xl motion-reduce:animate-none md:w-[360px]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Waves size={18} strokeWidth={2} />
            </span>
            <span className="truncate">西灣衝浪社</span>
          </span>

          <button
            ref={closeButtonRef}
            type="button"
            aria-label="關閉選單"
            title="關閉選單"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-bg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {user && (
            <div className="mb-4 rounded-2xl border border-border bg-bg p-3">
              <p translate="no" className="truncate font-medium text-slate-900">
                {profile?.full_name || "未填姓名"}
              </p>
              <p className="mt-1">
                {profile ? (
                  <Badge tone={getRoleTone(profile.role)}>
                    {roleLabels[profile.role]}
                  </Badge>
                ) : (
                  <span className="text-xs text-slate-500">讀取身分中...</span>
                )}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <Mail size={13} className="shrink-0" />
                <span className="truncate">{user.email}</span>
              </p>
            </div>
          )}

          <nav aria-label="功能選單" className="flex flex-col gap-5">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-slate-400">
                  {group.title}
                </p>
                <ul className="flex flex-col gap-1">
                  {group.links.map((link) => {
                    const isActive =
                      pathname === link.href ||
                      (link.href !== "/" && pathname.startsWith(link.href));
                    const Icon = link.icon;

                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={onClose}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex min-h-11 items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                            isActive
                              ? "bg-primary-light text-primary"
                              : "text-slate-700 hover:bg-bg"
                          }`}
                        >
                          <Icon
                            size={18}
                            strokeWidth={1.75}
                            className="mt-0.5 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <span className="truncate">{link.label}</span>
                              {link.attentionLabel && (
                                <>
                                  <span
                                    aria-hidden="true"
                                    className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                                  />
                                  <span className="sr-only">
                                    （{link.attentionLabel}）
                                  </span>
                                </>
                              )}
                            </span>
                            <span
                              className={`mt-0.5 block text-xs ${
                                isActive ? "text-primary/80" : "text-slate-500"
                              }`}
                            >
                              {link.description}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="border-t border-border p-4">
          {user ? (
            <Button
              variant="outline"
              fullWidth
              icon={<LogOut size={16} />}
              onClick={() => {
                onClose();
                onLogout();
              }}
              disabled={isLoading}
            >
              登出
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  onClose();
                  onLogin();
                }}
                disabled={isLoading}
              >
                Google 登入
              </Button>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                登入後會自動建立社員資料，預設身分為待審核，需由幹部或管理員審核。
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
