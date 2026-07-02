"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Navbar } from "@/components/Navbar";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { createClient } from "@/lib/supabase/client";
import {
  profileSelectColumns,
  reviewRequiredSurfLevels,
  roleLabels,
  surfLevelDescriptions,
  type Profile,
  type SurfLevel,
} from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

export default function ProfilePage() {
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    setStatusMessage,
    reloadProfile,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar
        user={user}
        profile={profile}
        isLoading={isLoading}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
      />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <section className="mb-6 border border-slate-200 bg-white p-5">
          <h1 className="text-2xl font-semibold tracking-normal">社員基本資料</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            填寫姓名、學號與衝浪程度。初階與中階可直接更新，中進階與進階需由幹部或管理員審核。
          </p>
        </section>

        {isLoading ? (
          <section className="border border-slate-200 bg-white p-5 text-sm text-slate-600">
            正在讀取資料...
          </section>
        ) : !user ? (
          <section className="border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">尚未登入</h2>
            <p className="mt-2 text-sm text-slate-600">
              請先使用 Google 登入後再填寫社員資料。
            </p>
            <button
              type="button"
              onClick={() => void handleGoogleLogin()}
              className="mt-4 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Google 登入
            </button>
          </section>
        ) : !profile ? (
          <section className="border border-slate-200 bg-white p-5 text-sm text-slate-600">
            正在建立或讀取社員資料...
          </section>
        ) : (
          <ProfileForm
            key={`${profile.id}-${profile.requested_surf_level ?? ""}`}
            user={user}
            profile={profile}
            setStatusMessage={setStatusMessage}
            reloadProfile={reloadProfile}
          />
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

function ProfileForm({
  user,
  profile,
  setStatusMessage,
  reloadProfile,
}: {
  user: User;
  profile: Profile;
  setStatusMessage: (message: string) => void;
  reloadProfile: () => Promise<Profile | null>;
}) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [studentId, setStudentId] = useState(profile.student_id ?? "");
  const [surfLevel, setSurfLevel] = useState(
    profile.requested_surf_level ?? profile.surf_level ?? "初階"
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      setStatusMessage("請填寫姓名。");
      return;
    }

    if (!studentId.trim()) {
      setStatusMessage("請填寫學號。");
      return;
    }

    if (!surfLevel) {
      setStatusMessage("請選擇衝浪程度。");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    const supabase = createClient();
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        student_id: studentId.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select(profileSelectColumns)
      .single();

    if (profileError) {
      setIsSaving(false);
      setStatusMessage(`儲存社員資料失敗：${profileError.message}`);
      return;
    }

    const selectedLevel = surfLevel as SurfLevel;
    const shouldRequestOrUpdateLevel =
      selectedLevel !== profile.surf_level ||
      profile.requested_surf_level !== null;

    if (shouldRequestOrUpdateLevel) {
      const { error: levelError } = await supabase.rpc("request_surf_level", {
        target_level: selectedLevel,
      });

      if (levelError) {
        setIsSaving(false);
        setStatusMessage(`更新衝浪程度失敗：${levelError.message}`);
        return;
      }
    }

    setIsSaving(false);

    if (reviewRequiredSurfLevels.includes(selectedLevel)) {
      setStatusMessage(`已送出${selectedLevel}程度審核。`);
    } else {
      setStatusMessage("社員資料已儲存。");
    }

    await reloadProfile();
  };

  return (
    <section className="border border-slate-200 bg-white p-5">
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-slate-500">Email</p>
          <p className="mt-1 break-all font-medium">{user.email}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">系統身分</p>
          <p className="mt-1 font-medium">{roleLabels[profile.role]}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">已核准程度</p>
          <p className="mt-1 font-medium">
            <SurfLevelBadge level={profile.surf_level} />
          </p>
        </div>
      </div>

      {profile.requested_surf_level && (
        <p className="mb-6 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          已送出{profile.requested_surf_level}程度審核，等待幹部或管理員處理。
        </p>
      )}

      <div className="grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-medium">姓名</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            placeholder="請輸入姓名"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">學號</span>
          <input
            type="text"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            className="border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            placeholder="請輸入學號"
          />
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-medium">衝浪程度</span>
          <div className="grid gap-3 md:grid-cols-2">
            {surfLevelDescriptions.map((level) => {
              const needsReview = reviewRequiredSurfLevels.includes(level.value);

              return (
                <label
                  key={level.value}
                  className={`border p-4 ${
                    surfLevel === level.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="surf_level"
                      value={level.value}
                      checked={surfLevel === level.value}
                      onChange={(event) => setSurfLevel(event.target.value)}
                    />
                    <SurfLevelBadge level={level.value} />
                    {needsReview && (
                      <span className="text-xs text-amber-700">需審核</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {level.description}
                  </p>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSaveProfile()}
        disabled={isSaving}
        className="mt-6 bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isSaving ? "儲存中..." : "儲存資料"}
      </button>
    </section>
  );
}
