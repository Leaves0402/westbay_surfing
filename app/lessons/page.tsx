"use client";

import { BookOpen, Info, Lock, RefreshCw } from "lucide-react";
import { LessonsPanel } from "@/components/lessons/LessonsPanel";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/Card";
import { canViewLessons } from "@/lib/permissions";
import { useAuthProfile } from "@/lib/useAuthProfile";

export default function LessonsPage() {
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    setStatusMessage,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

  const canView = canViewLessons(profile);

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
              <BookOpen size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">社課</h1>
              <p className="mt-1 text-sm text-text-secondary">
                查看社課時間、教學與名額，並在這裡完成報名或候補。
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
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-appBg text-text-secondary">
                <Lock size={18} strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="font-semibold text-text-primary">尚未登入</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  請先登入後再查看社課。
                </p>
              </div>
            </div>
          </Card>
        ) : !canView ? (
          <Card className="border-warning/30 bg-warning-light">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                <Lock size={18} strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="font-semibold text-text-primary">尚未開通社課權限</h2>
                <p className="mt-1 text-sm leading-6 text-text-primary/80">
                  目前身分只能登入與填寫資料，請等待幹部或管理員審核。
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <LessonsPanel
            userId={user.id}
            profile={profile}
            onStatusMessage={setStatusMessage}
          />
        )}

        {statusMessage && (
          <Card className="mt-6 flex items-start gap-2 text-sm text-text-secondary">
            <Info size={16} className="mt-0.5 shrink-0 text-text-secondary" />
            <span>{statusMessage}</span>
          </Card>
        )}
      </div>
    </main>
  );
}
