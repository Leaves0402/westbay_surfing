"use client";

import {
  AlertTriangle,
  Info,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Settings,
  Wrench,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/Card";
import { canViewMaintenancePage } from "@/lib/permissions";
import { useAuthProfile } from "@/lib/useAuthProfile";

export default function MaintenancePage() {
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

  const canView = canViewMaintenancePage(profile);

  return (
    <main className="min-h-screen bg-appBg text-text-primary">
      <Navbar
        user={user}
        profile={profile}
        isLoading={isLoading}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
      />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Wrench size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                系統維護與聯絡
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                幹部與管理員可查看維護聯絡方式、系統架構與注意事項。
              </p>
            </div>
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
              <Lock size={18} className="mt-0.5 text-text-secondary" />
              <div>
                <h2 className="font-semibold text-text-primary">尚未登入</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  請先登入後再查看此頁面。
                </p>
              </div>
            </div>
          </Card>
        ) : !canView ? (
          <Card className="border-warning/30 bg-warning-light">
            <div className="flex items-start gap-3">
              <Lock size={18} className="mt-0.5 text-warning" />
              <div>
                <h2 className="font-semibold text-text-primary">
                  你沒有權限查看此頁面
                </h2>
                <p className="mt-1 text-sm leading-6 text-text-primary/80">
                  此頁面僅供幹部與管理員查看。
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Mail size={18} className="text-primary" />
                <h2 className="font-semibold text-text-primary">主要維護人</h2>
              </div>
              <div className="space-y-2 text-sm text-text-secondary">
                <p>
                  <span className="font-medium text-text-primary">
                    主要維護人：
                  </span>
                  葉宗庭
                </p>
                <p>
                  <span className="font-medium text-text-primary">身分：</span>
                  116 中山大學光電系，第二屆衝浪社幹部
                </p>
                <div className="pt-2">
                  <p className="font-medium text-text-primary">聯絡方式：</p>
                  <ul className="mt-1 space-y-1">
                    <li className="flex items-center gap-2">
                      <Mail size={14} />
                      Email：
                      <a
                        href="mailto:tom.yeh.940402@gmail.com"
                        className="text-primary hover:underline"
                      >
                        tom.yeh.940402@gmail.com
                      </a>
                    </li>
                    <li className="flex items-center gap-2">
                      <Phone size={14} />
                      手機：
                      <a
                        href="tel:0965594620"
                        className="text-primary hover:underline"
                      >
                        0965594620
                      </a>
                    </li>
                  </ul>
                </div>
                <div className="pt-2">
                  <p className="font-medium text-text-primary">可聯絡事項：</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    <li>網站 bug</li>
                    <li>權限調整</li>
                    <li>資料庫問題</li>
                    <li>部署問題</li>
                    <li>功能新增</li>
                  </ul>
                </div>
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Settings size={18} className="text-primary" />
                <h2 className="font-semibold text-text-primary">系統架構</h2>
              </div>
              <ul className="space-y-1 text-sm text-text-secondary">
                <li>前端：Next.js</li>
                <li>資料庫 / Auth：Supabase</li>
                <li>部署：Vercel</li>
                <li>程式碼管理：GitHub</li>
                <li>登入方式：Google Login</li>
              </ul>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                <h2 className="font-semibold text-text-primary">維護注意事項</h2>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                <li>不要公開 .env.local。</li>
                <li>不要把 Supabase service_role key 放到前端。</li>
                <li>不要刪除 Supabase auth.users。</li>
                <li>修改資料庫前請先確認 SQL 內容。</li>
                <li>main 分支視為正式部署分支。</li>
                <li>功能分支 build / Vercel 通過後再合併 main。</li>
                <li>若要新增功能或改資料庫結構，請先和主要維護人確認。</li>
              </ul>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Info size={18} className="text-primary" />
                <h2 className="font-semibold text-text-primary">常見維護流程</h2>
              </div>
              <div className="space-y-4 text-sm text-text-secondary">
                <div>
                  <p className="font-medium text-text-primary">更新網站功能：</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    <li>在功能分支修改。</li>
                    <li>執行 npm run build。</li>
                    <li>push 到 GitHub。</li>
                    <li>確認 Vercel build 通過。</li>
                    <li>合併到 main。</li>
                  </ol>
                </div>
                <div>
                  <p className="font-medium text-text-primary">修改資料庫：</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    <li>先在 docs/sql 撰寫 SQL 檔案。</li>
                    <li>檢查 SQL 是否會影響既有資料。</li>
                    <li>到 Supabase SQL Editor 執行。</li>
                    <li>回網站測試功能。</li>
                  </ol>
                </div>
              </div>
            </Card>
          </div>
        )}

        {statusMessage && (
          <Card className="mt-6 flex items-start gap-2 text-sm text-text-secondary">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>{statusMessage}</span>
          </Card>
        )}
      </div>
    </main>
  );
}
