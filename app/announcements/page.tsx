"use client";

import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import {
  canManageAnnouncements,
  canViewAnnouncements,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import type { Announcement } from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AnnouncementsPage() {
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    setStatusMessage,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState("");
  const [newAnnouncementContent, setNewAnnouncementContent] = useState("");
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<
    string | null
  >(null);
  const [editingAnnouncementTitle, setEditingAnnouncementTitle] = useState("");
  const [editingAnnouncementContent, setEditingAnnouncementContent] =
    useState("");
  const [updatingAnnouncementId, setUpdatingAnnouncementId] = useState<
    string | null
  >(null);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<
    string | null
  >(null);

  const canView = canViewAnnouncements(profile);
  const canManage = canManageAnnouncements(profile);

  const loadAnnouncements = useCallback(async () => {
    setIsLoadingAnnouncements(true);
    setStatusMessage("");

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
  }, [setStatusMessage]);

  useEffect(() => {
    if (!canView) return;
    queueMicrotask(() => void loadAnnouncements());
  }, [canView, loadAnnouncements]);

  const handleCreateAnnouncement = async () => {
    if (!user) {
      setStatusMessage("請先登入後再新增公告。");
      return;
    }

    if (!canManage) {
      setStatusMessage("只有幹部與管理員可以新增公告。");
      return;
    }

    if (!newAnnouncementTitle.trim()) {
      setStatusMessage("請填寫公告標題。");
      return;
    }

    if (!newAnnouncementContent.trim()) {
      setStatusMessage("請填寫公告內容。");
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
    setStatusMessage("公告已新增。");
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
    if (!canManage) {
      setStatusMessage("只有幹部與管理員可以編輯公告。");
      return;
    }

    if (!editingAnnouncementTitle.trim()) {
      setStatusMessage("請填寫公告標題。");
      return;
    }

    if (!editingAnnouncementContent.trim()) {
      setStatusMessage("請填寫公告內容。");
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
    setStatusMessage("公告已更新。");
    await loadAnnouncements();
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!canManage) {
      setStatusMessage("只有幹部與管理員可以刪除公告。");
      return;
    }

    const confirmed = window.confirm("確定要刪除這則公告嗎？");
    if (!confirmed) return;

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

    setStatusMessage("公告已刪除。");
    await loadAnnouncements();
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar
        user={user}
        profile={profile}
        isLoading={isLoading}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <section className="mb-6 border border-slate-200 bg-white p-5">
          <h1 className="text-2xl font-semibold tracking-normal">公告</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            社員以上可以查看公告；幹部與管理員可以新增、編輯與刪除公告。
          </p>
        </section>

        {isLoading ? (
          <section className="border border-slate-200 bg-white p-5 text-sm text-slate-600">
            正在讀取登入狀態...
          </section>
        ) : !user ? (
          <section className="border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">尚未登入</h2>
            <p className="mt-2 text-sm text-slate-600">
              請先登入後再查看公告。
            </p>
          </section>
        ) : !canView ? (
          <section className="border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-semibold text-amber-950">尚未開通公告權限</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              目前身份只能登入與填寫資料，請等待幹部或管理員審核。
            </p>
          </section>
        ) : (
          <>
            {canManage && (
              <section className="mb-6 border border-slate-200 bg-white p-5">
                <h2 className="font-semibold">新增公告</h2>
                <div className="mt-4 grid gap-3">
                  <input
                    type="text"
                    value={newAnnouncementTitle}
                    onChange={(event) =>
                      setNewAnnouncementTitle(event.target.value)
                    }
                    className="border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    placeholder="公告標題"
                  />
                  <textarea
                    value={newAnnouncementContent}
                    onChange={(event) =>
                      setNewAnnouncementContent(event.target.value)
                    }
                    className="min-h-28 border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    placeholder="公告內容"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleCreateAnnouncement()}
                  disabled={isCreatingAnnouncement}
                  className="mt-4 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isCreatingAnnouncement ? "新增中..." : "新增公告"}
                </button>
              </section>
            )}

            <section className="grid gap-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-semibold">公告列表</h2>
                <button
                  type="button"
                  onClick={() => void loadAnnouncements()}
                  className="border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                >
                  重新整理
                </button>
              </div>

              {isLoadingAnnouncements ? (
                <p className="border border-slate-200 bg-white p-5 text-sm text-slate-600">
                  正在讀取公告...
                </p>
              ) : announcements.length === 0 ? (
                <p className="border border-slate-200 bg-white p-5 text-sm text-slate-600">
                  目前沒有公告。
                </p>
              ) : (
                announcements.map((announcement) => {
                  const isEditing = editingAnnouncementId === announcement.id;

                  return (
                    <article
                      key={announcement.id}
                      className="border border-slate-200 bg-white p-5"
                    >
                      {isEditing ? (
                        <div className="grid gap-3">
                          <input
                            type="text"
                            value={editingAnnouncementTitle}
                            onChange={(event) =>
                              setEditingAnnouncementTitle(event.target.value)
                            }
                            className="border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                          />
                          <textarea
                            value={editingAnnouncementContent}
                            onChange={(event) =>
                              setEditingAnnouncementContent(event.target.value)
                            }
                            className="min-h-28 border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleUpdateAnnouncement(announcement.id)
                              }
                              disabled={updatingAnnouncementId === announcement.id}
                              className="bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                            >
                              {updatingAnnouncementId === announcement.id
                                ? "更新中..."
                                : "儲存"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditAnnouncement}
                              className="border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="text-lg font-semibold">
                                {announcement.title}
                              </h3>
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDateTime(announcement.created_at)}
                              </p>
                            </div>

                            {canManage && (
                              <div className="flex shrink-0 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    startEditAnnouncement(announcement)
                                  }
                                  className="border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  編輯
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleDeleteAnnouncement(
                                      announcement.id
                                    )
                                  }
                                  disabled={
                                    deletingAnnouncementId === announcement.id
                                  }
                                  className="border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                >
                                  {deletingAnnouncementId === announcement.id
                                    ? "刪除中..."
                                    : "刪除"}
                                </button>
                              </div>
                            )}
                          </div>

                          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {announcement.content}
                          </p>
                        </>
                      )}
                    </article>
                  );
                })
              )}
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
