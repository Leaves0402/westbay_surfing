"use client";

import Link from "next/link";
import {
  CircleAlert,
  Gauge,
  Home as HomeIcon,
  Info,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  Waves,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { MobileTabBar } from "@/components/ui/MobileTabBar";
import { getRoleTone } from "@/lib/badgeTones";
import {
  canManageRentalSlots,
  canViewAnnouncements,
  canViewMembers,
  canViewRentals,
  canViewSurfTrips,
} from "@/lib/permissions";
import { roleLabels } from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

const featureIcons = {
  "/profile": UserRound,
  "/announcements": Megaphone,
  "/rentals": Waves,
  "/trips": MapPin,
  "/admin/members": Users,
} as const;

export default function Home() {
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

  const featureLinks = [
    {
      href: "/profile",
      title: "社員基本資料",
      description: "填寫姓名、學號與衝浪程度，審核前也可以更新資料。",
      visible: Boolean(user),
    },
    {
      href: "/announcements",
      title: "公告",
      description: "查看社團公告；幹部與管理員可以新增、編輯、刪除。",
      visible: canViewAnnouncements(profile),
    },
    {
      href: "/rentals",
      title: "租板",
      description: canManageRentalSlots(profile)
        ? "查看、登記與管理租板時段。"
        : "查看可租板時段並登記。",
      visible: canViewRentals(profile),
    },
    {
      href: "/trips",
      title: "揪外衝",
      description: "發起外衝活動、選擇浪點，並查看目前行程。",
      visible: canViewSurfTrips(profile),
    },
    {
      href: "/admin/members",
      title: "社員名單",
      description: "瀏覽正式成員；幹部與管理員可審核社員與程度申請。",
      visible: canViewMembers(profile),
    },
  ].filter((link) => link.visible);

  return (
    <main className="min-h-screen bg-appBg pb-24 text-text-primary md:pb-10">
      <Navbar
        user={user}
        profile={profile}
        isLoading={isLoading}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
      />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Card className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                <HomeIcon size={22} strokeWidth={1.75} />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">首頁</h1>
                <p className="mt-1 text-sm text-text-secondary">
                  這裡顯示目前登入狀態與可用功能入口。
                </p>
              </div>
            </div>

            {!user && (
              <Button
                variant="primary"
                fullWidth
                className="sm:w-auto"
                onClick={() => void handleGoogleLogin()}
                disabled={isLoading}
              >
                Google 登入
              </Button>
            )}
          </div>
        </Card>

        {isLoading ? (
          <Card className="flex items-center gap-2 text-sm text-text-secondary">
            <RefreshCw size={16} className="animate-spin" />
            正在讀取登入狀態...
          </Card>
        ) : !user ? (
          <Card>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-appBg text-text-secondary">
                <Lock size={18} strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="font-semibold text-text-primary">尚未登入</h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  請先使用 Google 登入。登入後會自動建立社員資料，預設身分為待審核。
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-3">
              <Card className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-appBg text-text-secondary">
                  <Mail size={16} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-text-secondary">登入帳號</p>
                  <p className="mt-1 truncate font-medium text-text-primary">
                    {user.email}
                  </p>
                </div>
              </Card>

              <Card className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-appBg text-text-secondary">
                  <ShieldCheck size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs text-text-secondary">系統身分</p>
                  <p className="mt-1">
                    {profile ? (
                      <Badge tone={getRoleTone(profile.role)}>
                        {roleLabels[profile.role]}
                      </Badge>
                    ) : (
                      <span className="font-medium text-text-primary">
                        讀取中
                      </span>
                    )}
                  </p>
                </div>
              </Card>

              <Card className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-appBg text-text-secondary">
                  <Gauge size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs text-text-secondary">已核准衝浪程度</p>
                  <p className="mt-1 font-medium text-text-primary">
                    <SurfLevelBadge level={profile?.surf_level} />
                  </p>
                </div>
              </Card>
            </section>

            {profile?.role === "pending" && (
              <Card className="mb-6 border-warning/30 bg-warning-light">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                    <CircleAlert size={18} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h2 className="font-semibold text-text-primary">待審核中</h2>
                    <p className="mt-1 text-sm leading-6 text-text-primary/80">
                      你目前只能登入與填寫基本資料。完成資料後請等待幹部或管理員審核。
                    </p>
                    <LinkButton href="/profile" className="mt-4">
                      前往填寫資料
                    </LinkButton>
                  </div>
                </div>
              </Card>
            )}

            <section className="grid gap-4 sm:grid-cols-2">
              {featureLinks.map((link) => {
                const Icon =
                  featureIcons[link.href as keyof typeof featureIcons];

                return (
                  <Link key={link.href} href={link.href} className="block">
                    <Card className="flex h-full min-h-11 items-start gap-3 transition-colors hover:border-primary/40">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                        <Icon size={18} strokeWidth={1.75} />
                      </span>
                      <div>
                        <h2 className="font-semibold text-text-primary">
                          {link.title}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-text-secondary">
                          {link.description}
                        </p>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </section>
          </>
        )}

        {statusMessage && (
          <Card className="mt-6 flex items-start gap-2 text-sm text-text-secondary">
            <Info size={16} className="mt-0.5 shrink-0 text-text-secondary" />
            <span>{statusMessage}</span>
          </Card>
        )}
      </div>

      <MobileTabBar />
    </main>
  );
}
