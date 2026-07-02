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
  created_at?: string;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const roleLabels: Record<Role, string> = {
  pending: "待審核",
  member: "社員",
  officer: "幹部",
  admin: "管理員",
};

const roleOptions: Role[] = ["pending", "member", "officer", "admin"];

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
    description: "可以控制斜跑方向，具備越浪技巧、衝浪禮儀。",
  },
  {
    value: "進階",
    title: "進階",
    description: "已能穩定掌握浪板控制，有自己的板子，開始練習動作。",
  },
];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [savingRoleUserId, setSavingRoleUserId] = useState<string | null>(null);
  const [deletingAnnouncementId, setDeletingAnnouncementId] =
    useState<string | null>(null);
  const [updatingAnnouncementId, setUpdatingAnnouncementId] =
    useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState("");

  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [surfLevel, setSurfLevel] = useState("");

  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState("");
  const [newAnnouncementContent, setNewAnnouncementContent] = useState("");

  const [editingAnnouncementId, setEditingAnnouncementId] =
    useState<string | null>(null);
  const [editingAnnouncementTitle, setEditingAnnouncementTitle] = useState("");
  const [editingAnnouncementContent, setEditingAnnouncementContent] =
    useState("");

  const canManageAnnouncements =
    profile?.role === "officer" || profile?.role === "admin";

  const canViewAnnouncements =
    profile?.role === "member" ||
    profile?.role === "officer" ||
    profile?.role === "admin";

  const syncProfileForm = (profileData: Profile) => {
    setFullName(profileData.full_name ?? "");
    setStudentId(profileData.student_id ?? "");
    setSurfLevel(profileData.surf_level ?? "");
  };

  const loadAllProfiles = async () => {
    setIsLoadingMembers(true);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, student_id, surf_level, role, created_at")
      .order("created_at", { ascending: false });

    setIsLoadingMembers(false);

    if (error) {
      setStatusMessage(`讀取社員列表失敗：${error.message}`);
      return;
    }

    setAllProfiles((data ?? []) as Profile[]);
  };

  const loadAnnouncements = async () => {
    setIsLoadingAnnouncements(true);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, content, created_by, created_at, updated_at")
      .order("created_at", { ascending: false });

    setIsLoadingAnnouncements(false);

    if (error) {
      setStatusMessage(`讀取公告失敗：${error.message}`);
      return;
    }

    setAnnouncements((data ?? []) as Announcement[]);
  };

  const loadOrCreateProfile = async (currentUser: User) => {
    const supabase = createClient();

    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("id, email, full_name, student_id, surf_level, role, created_at")
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

      if (["member", "officer", "admin"].includes(typedProfile.role)) {
        await loadAnnouncements();
      }

      if (typedProfile.role === "admin") {
        await loadAllProfiles();
      }

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
      .select("id, email, full_name, student_id, surf_level, role, created_at")
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
        setAllProfiles([]);
        setAnnouncements([]);
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
    setAllProfiles([]);
    setAnnouncements([]);
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
      .select("id, email, full_name, student_id, surf_level, role, created_at")
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

    if (["member", "officer", "admin"].includes(typedProfile.role)) {
      await loadAnnouncements();
    }

    if (typedProfile.role === "admin") {
      await loadAllProfiles();
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!user || !profile) {
      setStatusMessage("尚未登入，無法新增公告");
      return;
    }

    if (!canManageAnnouncements) {
      setStatusMessage("只有幹部或管理員可以新增公告");
      return;
    }

    if (!newAnnouncementTitle.trim()) {
      setStatusMessage("請填寫公告標題");
      return;
    }

    if (!newAnnouncementContent.trim()) {
      setStatusMessage("請填寫公告內容");
      return;
    }

    setIsCreatingAnnouncement(true);
    setStatusMessage("");

    const supabase = createClient();

    const { error } = await supabase.from("announcements").insert({
      title: newAnnouncementTitle.trim(),
      content: newAnnouncementContent.trim(),
      created_by: user.id,
    });

    setIsCreatingAnnouncement(false);

    if (error) {
      setStatusMessage(`新增公告失敗：${error.message}`);
      return;
    }

    setNewAnnouncementTitle("");
    setNewAnnouncementContent("");
    setStatusMessage("公告已新增");
    await loadAnnouncements();
  };

  const startEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncementId(announcement.id);
    setEditingAnnouncementTitle(announcement.title);
    setEditingAnnouncementContent(announcement.content);
    setStatusMessage("");
  };

  const cancelEditAnnouncement = () => {
    setEditingAnnouncementId(null);
    setEditingAnnouncementTitle("");
    setEditingAnnouncementContent("");
  };

  const handleUpdateAnnouncement = async (announcementId: string) => {
    if (!canManageAnnouncements) {
      setStatusMessage("只有幹部或管理員可以編輯公告");
      return;
    }

    if (!editingAnnouncementTitle.trim()) {
      setStatusMessage("請填寫公告標題");
      return;
    }

    if (!editingAnnouncementContent.trim()) {
      setStatusMessage("請填寫公告內容");
      return;
    }

    setUpdatingAnnouncementId(announcementId);
    setStatusMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("announcements")
      .update({
        title: editingAnnouncementTitle.trim(),
        content: editingAnnouncementContent.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", announcementId);

    setUpdatingAnnouncementId(null);

    if (error) {
      setStatusMessage(`更新公告失敗：${error.message}`);
      return;
    }

    cancelEditAnnouncement();
    setStatusMessage("公告已更新");
    await loadAnnouncements();
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!canManageAnnouncements) {
      setStatusMessage("只有幹部或管理員可以刪除公告");
      return;
    }

    const confirmed = window.confirm("確定要刪除這則公告嗎？");

    if (!confirmed) {
      return;
    }

    setDeletingAnnouncementId(announcementId);
    setStatusMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", announcementId);

    setDeletingAnnouncementId(null);

    if (error) {
      setStatusMessage(`刪除公告失敗：${error.message}`);
      return;
    }

    setStatusMessage("公告已刪除");
    await loadAnnouncements();
  };

  const handleUpdateRole = async (targetProfile: Profile, newRole: Role) => {
    if (!user || profile?.role !== "admin") {
      setStatusMessage("你不是管理員，無法修改社員身分");
      return;
    }

    if (targetProfile.id === user.id) {
      setStatusMessage("不能在這裡修改自己的管理員身分，避免鎖死後台權限");
      return;
    }

    setSavingRoleUserId(targetProfile.id);
    setStatusMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetProfile.id);

    setSavingRoleUserId(null);

    if (error) {
      setStatusMessage(`更新社員身分失敗：${error.message}`);
      return;
    }

    setStatusMessage(`已將 ${targetProfile.email} 更新為：${roleLabels[newRole]}`);
    await loadAllProfiles();
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
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

        {profile && canViewAnnouncements && (
          <div className="mb-8 rounded-xl border border-slate-200 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">公告</h2>
                <p className="mt-1 text-sm text-slate-600">
                  社員、幹部與管理員可以查看公告。
                </p>
              </div>

              <button
                onClick={loadAnnouncements}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                重新整理
              </button>
            </div>

            {canManageAnnouncements && (
              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-3 font-medium">新增公告</h3>

                <div className="grid gap-3">
                  <label className="grid gap-1">
                    <span className="text-sm font-medium">公告標題</span>
                    <input
                      value={newAnnouncementTitle}
                      onChange={(event) =>
                        setNewAnnouncementTitle(event.target.value)
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2"
                      placeholder="例如：本週租板注意事項"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">公告內容</span>
                    <textarea
                      value={newAnnouncementContent}
                      onChange={(event) =>
                        setNewAnnouncementContent(event.target.value)
                      }
                      className="min-h-28 rounded-xl border border-slate-300 px-3 py-2"
                      placeholder="輸入公告內容"
                    />
                  </label>

                  <button
                    onClick={handleCreateAnnouncement}
                    disabled={isCreatingAnnouncement}
                    className="w-fit rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isCreatingAnnouncement ? "新增中..." : "新增公告"}
                  </button>
                </div>
              </div>
            )}

            {isLoadingAnnouncements ? (
              <p className="text-sm text-slate-600">讀取公告中...</p>
            ) : announcements.length > 0 ? (
              <div className="grid gap-4">
                {announcements.map((announcement) => (
                  <article
                    key={announcement.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    {editingAnnouncementId === announcement.id ? (
                      <div className="grid gap-3">
                        <label className="grid gap-1">
                          <span className="text-sm font-medium">公告標題</span>
                          <input
                            value={editingAnnouncementTitle}
                            onChange={(event) =>
                              setEditingAnnouncementTitle(event.target.value)
                            }
                            className="rounded-xl border border-slate-300 px-3 py-2"
                          />
                        </label>

                        <label className="grid gap-1">
                          <span className="text-sm font-medium">公告內容</span>
                          <textarea
                            value={editingAnnouncementContent}
                            onChange={(event) =>
                              setEditingAnnouncementContent(event.target.value)
                            }
                            className="min-h-28 rounded-xl border border-slate-300 px-3 py-2"
                          />
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              handleUpdateAnnouncement(announcement.id)
                            }
                            disabled={updatingAnnouncementId === announcement.id}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                          >
                            {updatingAnnouncementId === announcement.id
                              ? "儲存中..."
                              : "儲存修改"}
                          </button>

                          <button
                            onClick={cancelEditAnnouncement}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-white"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold">
                              {announcement.title}
                            </h3>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                              {announcement.content}
                            </p>
                          </div>

                          {canManageAnnouncements && (
                            <div className="flex shrink-0 gap-2">
                              <button
                                onClick={() =>
                                  startEditAnnouncement(announcement)
                                }
                                className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-white"
                              >
                                編輯
                              </button>

                              <button
                                onClick={() =>
                                  handleDeleteAnnouncement(announcement.id)
                                }
                                disabled={
                                  deletingAnnouncementId === announcement.id
                                }
                                className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                              >
                                {deletingAnnouncementId === announcement.id
                                  ? "刪除中..."
                                  : "刪除"}
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          發布時間：
                          {new Date(announcement.created_at).toLocaleString(
                            "zh-TW"
                          )}
                        </p>
                      </>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">目前沒有公告。</p>
            )}
          </div>
        )}

        {profile?.role === "admin" && (
          <div className="mb-8 rounded-xl border border-slate-200 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">管理員：社員身分管理</h2>
                <p className="mt-1 text-sm text-slate-600">
                  管理社員系統身分：待審核、社員、幹部、管理員。
                </p>
              </div>

              <button
                onClick={loadAllProfiles}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                重新整理
              </button>
            </div>

            {isLoadingMembers ? (
              <p className="text-sm text-slate-600">讀取社員列表中...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-3 pr-4 font-medium">姓名</th>
                      <th className="py-3 pr-4 font-medium">學號</th>
                      <th className="py-3 pr-4 font-medium">Email</th>
                      <th className="py-3 pr-4 font-medium">衝浪程度</th>
                      <th className="py-3 pr-4 font-medium">系統身分</th>
                    </tr>
                  </thead>

                  <tbody>
                    {allProfiles.map((member) => (
                      <tr key={member.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4">
                          {member.full_name || "未填"}
                        </td>
                        <td className="py-3 pr-4">
                          {member.student_id || "未填"}
                        </td>
                        <td className="py-3 pr-4">{member.email}</td>
                        <td className="py-3 pr-4">
                          {member.surf_level || "未填"}
                        </td>
                        <td className="py-3 pr-4">
                          <select
                            value={member.role}
                            disabled={
                              member.id === user?.id ||
                              savingRoleUserId === member.id
                            }
                            onChange={(event) =>
                              handleUpdateRole(
                                member,
                                event.target.value as Role
                              )
                            }
                            className="rounded-lg border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {roleLabels[role]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {allProfiles.length === 0 && (
                  <p className="py-4 text-sm text-slate-600">
                    目前沒有讀到社員資料。
                  </p>
                )}
              </div>
            )}

            <p className="mt-3 text-xs text-slate-500">
              你不能在這裡修改自己的系統身分，避免把唯一管理員改掉。
            </p>
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