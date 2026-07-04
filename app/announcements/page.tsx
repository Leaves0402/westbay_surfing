"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Info,
  Lock,
  Megaphone,
  PenLine,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { LessonsPanel } from "@/components/lessons/LessonsPanel";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { MobileTabBar } from "@/components/ui/MobileTabBar";
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

function AnnouncementSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="h-4 w-1/3 rounded bg-appBg" />
      <div className="mt-2 h-3 w-1/5 rounded bg-appBg" />
      <div className="mt-4 h-3 w-full rounded bg-appBg" />
      <div className="mt-2 h-3 w-4/5 rounded bg-appBg" />
    </Card>
  );
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
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Megaphone size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">公告</h1>
              <p className="mt-1 text-sm text-text-secondary">
                社員以上可以查看公告；幹部與管理員可以新增、編輯與刪除公告。
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
                  請先登入後再查看公告。
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
                <h2 className="font-semibold text-text-primary">尚未開通公告權限</h2>
                <p className="mt-1 text-sm leading-6 text-text-primary/80">
                  目前身份只能登入與填寫資料，請等待幹部或管理員審核。
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <LessonsPanel
                userId={user.id}
                profile={profile}
                onStatusMessage={setStatusMessage}
              />
            </div>

            {canManage && (
              <Card className="mb-6">
                <div className="mb-4 flex items-center gap-2">
                  <Plus size={18} className="text-primary" strokeWidth={2} />
                  <h2 className="font-semibold text-text-primary">新增公告</h2>
                </div>

                <div className="grid gap-4">
                  <FormField label="公告標題">
                    <input
                      type="text"
                      value={newAnnouncementTitle}
                      onChange={(event) =>
                        setNewAnnouncementTitle(event.target.value)
                      }
                      className={fieldControlClasses}
                      placeholder="公告標題"
                    />
                  </FormField>
                  <FormField label="公告內容">
                    <textarea
                      value={newAnnouncementContent}
                      onChange={(event) =>
                        setNewAnnouncementContent(event.target.value)
                      }
                      className={`min-h-28 ${fieldControlClasses}`}
                      placeholder="公告內容"
                    />
                  </FormField>
                </div>

                <Button
                  variant="primary"
                  fullWidth
                  className="mt-4 sm:w-auto"
                  icon={<Plus size={18} />}
                  onClick={() => void handleCreateAnnouncement()}
                  disabled={isCreatingAnnouncement}
                >
                  {isCreatingAnnouncement ? "新增中..." : "新增公告"}
                </Button>
              </Card>
            )}

            <section className="grid gap-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-semibold text-text-primary">公告列表</h2>
                <Button
                  variant="outline"
                  icon={
                    <RefreshCw
                      size={16}
                      className={isLoadingAnnouncements ? "animate-spin" : ""}
                    />
                  }
                  onClick={() => void loadAnnouncements()}
                >
                  重新整理
                </Button>
              </div>

              {isLoadingAnnouncements ? (
                <>
                  <AnnouncementSkeleton />
                  <AnnouncementSkeleton />
                </>
              ) : announcements.length === 0 ? (
                <Card className="flex flex-col items-center gap-2 py-10 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-appBg text-text-secondary">
                    <Megaphone size={22} strokeWidth={1.75} />
                  </span>
                  <h3 className="font-semibold text-text-primary">目前沒有公告</h3>
                  <p className="max-w-xs text-sm text-text-secondary">
                    {canManage
                      ? "使用上方表單新增第一則公告。"
                      : "有新公告時會顯示在這裡。"}
                  </p>
                </Card>
              ) : (
                announcements.map((announcement) => {
                  const isEditing = editingAnnouncementId === announcement.id;

                  return (
                    <Card key={announcement.id}>
                      {isEditing ? (
                        <div className="grid gap-4">
                          <FormField label="公告標題">
                            <input
                              type="text"
                              value={editingAnnouncementTitle}
                              onChange={(event) =>
                                setEditingAnnouncementTitle(event.target.value)
                              }
                              className={fieldControlClasses}
                            />
                          </FormField>
                          <FormField label="公告內容">
                            <textarea
                              value={editingAnnouncementContent}
                              onChange={(event) =>
                                setEditingAnnouncementContent(event.target.value)
                              }
                              className={`min-h-28 ${fieldControlClasses}`}
                            />
                          </FormField>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="primary"
                              onClick={() =>
                                void handleUpdateAnnouncement(announcement.id)
                              }
                              disabled={updatingAnnouncementId === announcement.id}
                            >
                              {updatingAnnouncementId === announcement.id
                                ? "更新中..."
                                : "儲存"}
                            </Button>
                            <Button
                              variant="outline"
                              icon={<X size={16} />}
                              onClick={cancelEditAnnouncement}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-text-primary">
                                {announcement.title}
                              </h3>
                              <p className="mt-1 text-xs text-text-secondary">
                                {formatDateTime(announcement.created_at)}
                              </p>
                            </div>

                            {canManage && (
                              <div className="flex shrink-0 gap-2">
                                <Button
                                  variant="outline"
                                  icon={<PenLine size={16} />}
                                  onClick={() =>
                                    startEditAnnouncement(announcement)
                                  }
                                >
                                  編輯
                                </Button>
                                <Button
                                  variant="danger"
                                  icon={<Trash2 size={16} />}
                                  onClick={() =>
                                    void handleDeleteAnnouncement(
                                      announcement.id
                                    )
                                  }
                                  disabled={
                                    deletingAnnouncementId === announcement.id
                                  }
                                >
                                  {deletingAnnouncementId === announcement.id
                                    ? "刪除中..."
                                    : "刪除"}
                                </Button>
                              </div>
                            )}
                          </div>

                          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-text-primary/80">
                            {announcement.content}
                          </p>
                        </>
                      )}
                    </Card>
                  );
                })
              )}
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
