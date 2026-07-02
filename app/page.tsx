"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Role = "pending" | "member" | "officer" | "admin";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  student_id: string | null;
  surf_level: string | null;
  role: Role;
};

const roleLabels: Record<Role, string> = {
  pending: "待審核",
  member: "社員",
  officer: "幹部",
  admin: "管理員",
};

const surfLevelDescriptions = [
  {
    value: "初階",
    title: "初階",
    description:
      "初學，還不會穩定斜跑，正在練習起乘、站穩、控制方向與基本安全觀念。",
  },
  {
    value: "中階",
    title: "中階",
    description:
      "已經可以斜跑，但還不穩定；正在練習判斷浪、選浪、維持速度與基本轉向。",
  },
  {
    value: "中進階",
    title: "中進階",
    description:
      "可以控制斜跑方向，具備越浪技巧、衝浪禮儀。",
  },
  {
    value: "進階",
    title: "進階",
    description:
      "已能穩定掌握浪板控制，有自己的板子，開始練習動作。",
  },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [surfLevel, setSurfLevel] = useState("");

  const syncProfileForm = (profileData: Profile) => {
    setFullName(profileData.full_name ?? "");
    setStudentId(profileData.student_id ?? "");
    setSurfLevel(profileData.surf_level ?? "");
  };

  const loadOrCreateProfile = async (currentUser: User) => {
    const supabase = createClient();

    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("id, email, full_name, student_id, surf_level, role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (selectError) {
      setStatusMessage(`讀取社員資料失敗：${selectError.message}`);
      return;
    }

    if (existingProfile) {
      const typedProfile = existingProfile as Profile;
      setProfile(typedProfile);
      syncProfileForm(typedProfile);
      setStatusMessage("已讀取社員資料");
      return;
    }

    const { error: insertError } = await supabase.from("profiles").insert({
      id: currentUser.id,
      email: currentUser.email ?? "",
      full_name: currentUser.user_metadata?.full_name ?? null,
      student_id: null,
      surf_level: null,
    });

    if (insertError) {
      setStatusMessage(`建立社員資料失敗：${insertError.message}`);
      return;
    }

    const { data: newProfile, error: newProfileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, student_id, surf_level, role")
      .eq("id", currentUser.id)
      .single();

    if (newProfileError) {
      setStatusMessage(`讀取新社員資料失敗：${newProfileError.message}`);
      return;
    }

    const typedProfile = newProfile as Profile;
    setProfile(typedProfile);
    syncProfileForm(typedProfile);
    setStatusMessage("已建立社員資料");
  };

  useEffect(() => {
    const supabase = createClient();

    const initUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (error) {
          setStatusMessage(`讀取登入狀態失敗：${error.message}`);
          return;
        }

        setUser(data.user);

        if (data.user) {
          await loadOrCreateProfile(data.user);
        }
      } catch (error) {
        setStatusMessage(
          error instanceof Error
            ? `初始化失敗：${error.message}`
            : "初始化失敗：未知錯誤"
        );
      } finally {
        setIsLoading(false);
      }
    };

    initUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        loadOrCreateProfile(session.user);
      } else {
        setProfile(null);
        setStatusMessage("");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    const supabase = createClient();

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleLogout = async () => {
    const supabase = createClient();

    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setStatusMessage("");
  };

  const handleSaveProfile = async () => {
    if (!user) {
      setStatusMessage("尚未登入，無法儲存社員資料");
      return;
    }

    if (!fullName.trim()) {
      setStatusMessage("請填寫姓名");
      return;
    }

    if (!studentId.trim()) {
      setStatusMessage("請填寫學號");
      return;
    }

    if (!surfLevel) {
      setStatusMessage("請選擇衝浪程度");
      return;
    }

    setIsSavingProfile(true);
    setStatusMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        student_id: studentId.trim(),
        surf_level: surfLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("id, email, full_name, student_id, surf_level, role")
      .single();

    setIsSavingProfile(false);

    if (error) {
      setStatusMessage(`儲存社員資料失敗：${error.message}`);
      return;
    }

    const typedProfile = data as Profile;
    setProfile(typedProfile);
    syncProfileForm(typedProfile);
    setStatusMessage("社員資料已儲存");
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <p className="mb-2 text-sm font-medium text-blue-600">
          West Bay Surf Club
        </p>

        <h1 className="mb-4 text-3xl font-bold">西灣衝浪社內部系統</h1>

        <p className="mb-8 text-slate-600">
          這是給社員與幹部使用的內部網站。第一版會先完成社員登入、社員資料、公告、租板日期登記與後台管理。
        </p>

        <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="mb-2 font-semibold">登入狀態</h2>

          {isLoading ? (
            <p className="text-sm text-slate-600">檢查登入狀態中...</p>
          ) : user ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                已登入：
                <span className="font-medium">{user.email}</span>
              </p>

              <p className="text-sm text-slate-700">
                系統身分：
                <span className="font-medium">
                  {profile ? roleLabels[profile.role] : "讀取中"}
                </span>
              </p>

              <button
                onClick={handleLogout}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                登出
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
            >
              使用 Google 登入
            </button>
          )}
        </div>

        {user && (
          <div className="mb-8 rounded-xl border border-slate-200 p-4">
            <h2 className="mb-4 font-semibold">社員基本資料</h2>

            <div className="grid gap-4">
              <label className="grid gap-1">
                <span className="text-sm font-medium">姓名</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="例如：葉宗庭"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-medium">學號</span>
                <input
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="例如：B123456789"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-medium">衝浪程度</span>
                <select
                  value={surfLevel}
                  onChange={(event) => setSurfLevel(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="">請選擇</option>
                  {surfLevelDescriptions.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3">
                {surfLevelDescriptions.map((level) => (
                  <div
                    key={level.value}
                    className={`rounded-xl border p-4 ${
                      surfLevel === level.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <h3 className="font-medium">{level.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {level.description}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="w-fit rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSavingProfile ? "儲存中..." : "儲存社員資料"}
              </button>
            </div>
          </div>
        )}

        {statusMessage && (
          <p className="mb-8 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {statusMessage}
          </p>
        )}

        <div className="grid gap-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold">社員功能</h2>
            <p className="mt-1 text-sm text-slate-600">
              Google 登入、填寫基本資料、查看公告、登記租板日期。
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold">幹部功能</h2>
            <p className="mt-1 text-sm text-slate-600">
              新增、編輯、刪除公告，開放可租板日期。
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold">管理員功能</h2>
            <p className="mt-1 text-sm text-slate-600">
              管理社員系統身分：待審核、社員、幹部、管理員。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}