"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import {
  canManageRentalSlots,
  canViewAnnouncements,
  canViewMembers,
  canViewRentals,
} from "@/lib/permissions";
import { roleLabels } from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

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
      href: "/admin/members",
      title: "社員名單",
      description: "瀏覽正式成員；幹部與管理員可審核社員與程度申請。",
      visible: canViewMembers(profile),
    },
  ].filter((link) => link.visible);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar
        user={user}
        profile={profile}
        isLoading={isLoading}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="mb-6 border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              
              <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
                首頁 
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                這裡顯示目前登入狀態與可用功能入口。
              </p>
            </div>

            {!user && (
              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={isLoading}
                className="bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Google 登入
              </button>
            )}
          </div>
        </section>

        {isLoading ? (
          <section className="border border-slate-200 bg-white p-5 text-sm text-slate-600">
            正在讀取登入狀態...
          </section>
        ) : !user ? (
          <section className="border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">尚未登入</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              請先使用 Google 登入。登入後會自動建立社員資料，預設身分為待審核。
            </p>
          </section>
        ) : (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">登入帳號</p>
                <p className="mt-2 break-all font-medium text-slate-900">
                  {user.email}
                </p>
              </div>

              <div className="border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">系統身分</p>
                <p className="mt-2 font-medium text-slate-900">
                  {profile ? roleLabels[profile.role] : "讀取中"}
                </p>
              </div>

              <div className="border border-slate-200 bg-white p-5">
                <p className="text-sm text-slate-500">已核准衝浪程度</p>
                <p className="mt-2 font-medium text-slate-900">
                  <SurfLevelBadge level={profile?.surf_level} />
                </p>
              </div>
            </section>

            {profile?.role === "pending" && (
              <section className="mb-6 border border-amber-200 bg-amber-50 p-5">
                <h2 className="font-semibold text-amber-950">待審核中</h2>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  你目前只能登入與填寫基本資料。完成資料後請等待幹部或管理員審核。
                </p>
                <Link
                  href="/profile"
                  className="mt-4 inline-flex bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-950"
                >
                  前往填寫資料
                </Link>
              </section>
            )}

            <section className="grid gap-4 md:grid-cols-2">
              {featureLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="border border-slate-200 bg-white p-5 hover:border-blue-300 hover:bg-blue-50"
                >
                  <h2 className="font-semibold text-slate-950">{link.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {link.description}
                  </p>
                </Link>
              ))}
            </section>
          </>
        )}

        {statusMessage && (
          <p className="mt-6 border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {statusMessage}
          </p>
        )}
      </div>
    </main>
  );
}
