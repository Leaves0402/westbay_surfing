"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Gauge,
  Info,
  ListChecks,
  Lock,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fieldControlClasses } from "@/components/ui/FormField";
import { MobileTabBar } from "@/components/ui/MobileTabBar";
import { getRoleTone } from "@/lib/badgeTones";
import {
  canManageMembers,
  canReviewPendingMembers,
  canReviewSurfLevelRequests,
  canViewMembers,
  compareRolesDescending,
  compareSurfLevelsDescending,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  officialMemberRoleOptions,
  profileSelectColumns,
  roleLabels,
  type Profile,
  type PublicMemberProfile,
  type Role,
} from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

function RowSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="h-4 w-1/3 rounded bg-appBg" />
      <div className="mt-3 h-3 w-2/3 rounded bg-appBg" />
    </Card>
  );
}

export default function MembersAdminPage() {
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    setStatusMessage,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

  const [officialMembers, setOfficialMembers] = useState<PublicMemberProfile[]>(
    []
  );
  const [pendingMembers, setPendingMembers] = useState<Profile[]>([]);
  const [surfLevelRequests, setSurfLevelRequests] = useState<Profile[]>([]);
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [savingRoleUserId, setSavingRoleUserId] = useState<string | null>(null);
  const [isApprovingPending, setIsApprovingPending] = useState(false);
  const [reviewingSurfLevelUserId, setReviewingSurfLevelUserId] = useState<
    string | null
  >(null);
  const [officialSearchQuery, setOfficialSearchQuery] = useState("");
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [isBatchRemoveMode, setIsBatchRemoveMode] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isRemovingMembers, setIsRemovingMembers] = useState(false);

  const canView = canViewMembers(profile);
  const canManage = canManageMembers(profile);
  const canReviewPending = canReviewPendingMembers(profile);
  const canReviewSurfLevels = canReviewSurfLevelRequests(profile);

  const sortedOfficialMembers = useMemo(
    () =>
      [...officialMembers].sort((a, b) => {
        const roleCompare = compareRolesDescending(a.role, b.role);
        if (roleCompare !== 0) return roleCompare;

        const surfCompare = compareSurfLevelsDescending(
          a.surf_level,
          b.surf_level
        );
        if (surfCompare !== 0) return surfCompare;

        return (a.full_name ?? "").localeCompare(b.full_name ?? "", "zh-Hant");
      }),
    [officialMembers]
  );

  const filteredOfficialMembers = useMemo(() => {
    const query = officialSearchQuery.trim().toLowerCase();
    if (!query) return sortedOfficialMembers;

    return sortedOfficialMembers.filter((member) =>
      (member.full_name ?? "").toLowerCase().includes(query)
    );
  }, [officialSearchQuery, sortedOfficialMembers]);

  const filteredPendingMembers = useMemo(() => {
    const query = pendingSearchQuery.trim().toLowerCase();
    if (!query) return pendingMembers;

    return pendingMembers.filter((member) => {
      const name = (member.full_name ?? "").toLowerCase();
      const studentId = (member.student_id ?? "").toLowerCase();
      const email = (member.email ?? "").toLowerCase();
      return (
        name.includes(query) ||
        studentId.includes(query) ||
        email.includes(query)
      );
    });
  }, [pendingMembers, pendingSearchQuery]);

  const canRemoveMember = useCallback(
    (member: PublicMemberProfile) =>
      canManage && member.id !== user?.id && member.role !== "admin",
    [canManage, user?.id]
  );

  const exitBatchRemoveMode = useCallback(() => {
    setIsBatchRemoveMode(false);
    setSelectedMemberIds(new Set());
  }, []);

  const loadMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    setStatusMessage("");

    const supabase = createClient();
    const officialResult = await supabase
      .from("public_member_profiles")
      .select("id, full_name, student_id, surf_level, role");

    if (officialResult.error) {
      setIsLoadingMembers(false);
      setStatusMessage(`讀取正式成員列表失敗：${officialResult.error.message}`);
      return;
    }

    setOfficialMembers((officialResult.data ?? []) as PublicMemberProfile[]);

    if (canReviewPending || canReviewSurfLevels) {
      const [pendingResult, requestResult] = await Promise.all([
        canReviewPending
          ? supabase
              .from("profiles")
              .select(profileSelectColumns)
              .eq("role", "pending")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        canReviewSurfLevels
          ? supabase
              .from("profiles")
              .select(profileSelectColumns)
              .not("requested_surf_level", "is", null)
              .order("requested_surf_level_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (pendingResult.error) {
        setIsLoadingMembers(false);
        setStatusMessage(`讀取待審核名單失敗：${pendingResult.error.message}`);
        return;
      }

      if (requestResult.error) {
        setIsLoadingMembers(false);
        setStatusMessage(`讀取程度審核名單失敗：${requestResult.error.message}`);
        return;
      }

      setPendingMembers((pendingResult.data ?? []) as Profile[]);
      setSurfLevelRequests((requestResult.data ?? []) as Profile[]);
    } else {
      setPendingMembers([]);
      setSurfLevelRequests([]);
    }

    setSelectedPendingIds(new Set());
    setIsLoadingMembers(false);
  }, [canReviewPending, canReviewSurfLevels, setStatusMessage]);

  useEffect(() => {
    if (!canView) return;
    queueMicrotask(() => void loadMembers());
  }, [canView, loadMembers]);

  const handleUpdateRole = async (
    targetProfile: PublicMemberProfile,
    newRole: Role
  ) => {
    if (!canManage) {
      setStatusMessage("只有幹部與管理員可以管理社員身分。");
      return;
    }

    if (targetProfile.id === user?.id) {
      setStatusMessage("不能在這裡調整自己的身分，避免鎖死權限。");
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

    setStatusMessage("社員身分已更新。");
    await loadMembers();
  };

  const togglePendingSelection = (profileId: string) => {
    setSelectedPendingIds((current) => {
      const next = new Set(current);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  };

  const handleApprovePendingMembers = async () => {
    if (!canReviewPending) {
      setStatusMessage("只有幹部與管理員可以核准待審核社員。");
      return;
    }

    const targetIds = Array.from(selectedPendingIds);
    if (targetIds.length === 0) {
      setStatusMessage("請先勾選要核准的待審核社員。");
      return;
    }

    setIsApprovingPending(true);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("approve_pending_members", {
      target_user_ids: targetIds,
    });

    setIsApprovingPending(false);

    if (error) {
      setStatusMessage(`核准待審核社員失敗：${error.message}`);
      return;
    }

    setStatusMessage("已核准成為社員。");
    await loadMembers();
  };

  const handleApproveSurfLevel = async (targetUserId: string) => {
    if (!canReviewSurfLevels) {
      setStatusMessage("只有幹部與管理員可以審核衝浪程度。");
      return;
    }

    setReviewingSurfLevelUserId(targetUserId);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("approve_surf_level_request", {
      target_user_id: targetUserId,
    });

    setReviewingSurfLevelUserId(null);

    if (error) {
      setStatusMessage(`核准程度失敗：${error.message}`);
      return;
    }

    setStatusMessage("衝浪程度已核准。");
    await loadMembers();
  };

  const handleRejectSurfLevel = async (targetUserId: string) => {
    if (!canReviewSurfLevels) {
      setStatusMessage("只有幹部與管理員可以審核衝浪程度。");
      return;
    }

    setReviewingSurfLevelUserId(targetUserId);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("reject_surf_level_request", {
      target_user_id: targetUserId,
    });

    setReviewingSurfLevelUserId(null);

    if (error) {
      setStatusMessage(`拒絕程度失敗：${error.message}`);
      return;
    }

    setStatusMessage("已拒絕衝浪程度申請。");
    await loadMembers();
  };

  const toggleMemberSelection = (member: PublicMemberProfile) => {
    if (!canRemoveMember(member)) return;

    setSelectedMemberIds((current) => {
      const next = new Set(current);
      if (next.has(member.id)) {
        next.delete(member.id);
      } else {
        next.add(member.id);
      }
      return next;
    });
  };

  const handleBatchRemoveClick = async () => {
    if (!canManage) {
      setStatusMessage("只有幹部與管理員可以移除正式成員。");
      return;
    }

    if (!isBatchRemoveMode) {
      setIsBatchRemoveMode(true);
      setSelectedMemberIds(new Set());
      return;
    }

    const removableIds = Array.from(selectedMemberIds).filter((id) => {
      const member = officialMembers.find((item) => item.id === id);
      return member ? canRemoveMember(member) : false;
    });

    if (removableIds.length === 0) {
      setStatusMessage("請先勾選要移除的成員。");
      return;
    }

    if (
      !window.confirm(
        `確定要移除選取的 ${removableIds.length} 位成員嗎？此操作無法復原。`
      )
    ) {
      return;
    }

    setIsRemovingMembers(true);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("remove_official_members", {
      target_user_ids: removableIds,
    });

    setIsRemovingMembers(false);

    if (error) {
      setStatusMessage(`移除成員失敗：${error.message}`);
      return;
    }

    exitBatchRemoveMode();
    setStatusMessage(`已移除 ${removableIds.length} 位成員。`);
    await loadMembers();
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
              <Users size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">社員名單</h1>
              <p className="mt-1 text-sm text-text-secondary">
                社員可瀏覽正式成員名單；幹部與管理員可審核待審核社員、調整身分與處理程度申請。
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
                  請先登入後再查看社員名單。
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
                <h2 className="font-semibold text-text-primary">尚未開通瀏覽權限</h2>
                <p className="mt-1 text-sm leading-6 text-text-primary/80">
                  待審核身分只能登入與填寫基本資料，尚不能瀏覽社員名單。
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6">
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-text-primary">正式成員列表</h2>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                    />
                    <input
                      type="search"
                      value={officialSearchQuery}
                      onChange={(event) =>
                        setOfficialSearchQuery(event.target.value)
                      }
                      placeholder="搜尋社員姓名"
                      className={`${fieldControlClasses} min-h-9 py-1.5 pl-9`}
                    />
                  </div>
                  {canManage && (
                    <>
                      {isBatchRemoveMode && (
                        <button
                          type="button"
                          aria-label="取消批量移除"
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-slate-600 transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={exitBatchRemoveMode}
                          disabled={isRemovingMembers}
                        >
                          <X size={18} />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="批量移除成員"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-danger/30 bg-danger-light text-lg font-medium leading-none text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => void handleBatchRemoveClick()}
                        disabled={
                          isRemovingMembers ||
                          (isBatchRemoveMode && selectedMemberIds.size === 0)
                        }
                      >
                        -
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label="重新整理"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-slate-700 transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      exitBatchRemoveMode();
                      void loadMembers();
                    }}
                    disabled={isLoadingMembers || isRemovingMembers}
                  >
                    <RefreshCw
                      size={18}
                      className={isLoadingMembers ? "animate-spin" : ""}
                    />
                  </button>
                </div>
              </div>

              {isLoadingMembers ? (
                <div className="grid gap-3">
                  <RowSkeleton />
                  <RowSkeleton />
                  <RowSkeleton />
                </div>
              ) : sortedOfficialMembers.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  目前沒有正式成員資料。
                </p>
              ) : filteredOfficialMembers.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  找不到符合條件的社員。
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full table-fixed border-collapse text-left text-xs md:text-sm">
                    <thead>
                      <tr className="border-b border-line bg-appBg text-xs text-text-secondary">
                        {isBatchRemoveMode && (
                          <th className="w-10 px-2 py-1.5 md:w-12 md:px-3 md:py-2" />
                        )}
                        <th className="w-[24%] px-2 py-1.5 font-medium md:px-3 md:py-2">
                          姓名
                        </th>
                        <th className="w-[26%] px-2 py-1.5 font-medium md:px-3 md:py-2">
                          學號
                        </th>
                        <th className="w-[20%] whitespace-nowrap px-2 py-1.5 font-medium md:px-3 md:py-2">
                          程度
                        </th>
                        <th className="w-[24%] px-2 py-1.5 font-medium md:px-3 md:py-2">
                          身分
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredOfficialMembers.map((member) => {
                        const removable = canRemoveMember(member);

                        return (
                          <tr
                            key={member.id}
                            className="border-b border-line last:border-b-0"
                          >
                            {isBatchRemoveMode && (
                              <td className="px-2 py-2 md:px-3">
                                {removable ? (
                                  <input
                                    type="checkbox"
                                    checked={selectedMemberIds.has(member.id)}
                                    onChange={() =>
                                      toggleMemberSelection(member)
                                    }
                                    disabled={isRemovingMembers}
                                    className="h-3.5 w-3.5 rounded border-line text-primary focus:ring-2 focus:ring-primary md:h-4 md:w-4"
                                    aria-label={`選取 ${member.full_name || "未填姓名"}`}
                                  />
                                ) : null}
                              </td>
                            )}
                            <td className="truncate px-2 py-2 font-medium text-text-primary md:px-3">
                              {member.full_name || "未填姓名"}
                            </td>
                            <td className="truncate px-2 py-2 text-text-secondary md:px-3">
                              {member.student_id || "未填學號"}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 md:px-3">
                              <span className="inline-block origin-left scale-90 md:scale-100">
                                <SurfLevelBadge level={member.surf_level} />
                              </span>
                            </td>
                            <td className="px-2 py-2 md:px-3">
                              {canManage ? (
                                <select
                                  value={member.role}
                                  disabled={
                                    member.id === user.id ||
                                    savingRoleUserId === member.id ||
                                    isRemovingMembers
                                  }
                                  onChange={(event) =>
                                    void handleUpdateRole(
                                      member,
                                      event.target.value as Role
                                    )
                                  }
                                  className={`${fieldControlClasses} h-8 w-20 px-1.5 py-0.5 text-xs md:h-9 md:w-28 md:px-2 md:py-1 md:text-sm`}
                                >
                                  {officialMemberRoleOptions.map((role) => (
                                    <option key={role} value={role}>
                                      {roleLabels[role]}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Badge
                                  tone={getRoleTone(member.role)}
                                  className="!px-1.5 !py-0.5 !text-[10px] md:!px-2 md:!py-1 md:!text-xs"
                                >
                                  {roleLabels[member.role]}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {canReviewPending && (
              <Card>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ListChecks size={18} className="text-primary" />
                    <h2 className="font-semibold text-text-primary">待審核名單</h2>
                  </div>
                  <div className="relative min-w-0 w-full sm:w-52">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
                    />
                    <input
                      type="search"
                      value={pendingSearchQuery}
                      onChange={(event) =>
                        setPendingSearchQuery(event.target.value)
                      }
                      placeholder="搜尋姓名、學號或 Email"
                      className={`${fieldControlClasses} min-h-9 py-1.5 pl-8 text-sm`}
                    />
                  </div>
                </div>

                {pendingMembers.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    目前沒有待審核社員。
                  </p>
                ) : filteredPendingMembers.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    找不到符合條件的待審核成員。
                  </p>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-line bg-appBg text-xs text-text-secondary">
                            <th className="px-3 py-2 font-medium">核准</th>
                            <th className="px-3 py-2 font-medium">姓名</th>
                            <th className="px-3 py-2 font-medium">學號</th>
                            <th className="px-3 py-2 font-medium">Email</th>
                            <th className="px-3 py-2 font-medium">衝浪程度</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPendingMembers.map((member) => (
                            <tr
                              key={member.id}
                              className="border-b border-line last:border-b-0"
                            >
                              <td className="px-3 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedPendingIds.has(member.id)}
                                  onChange={() =>
                                    togglePendingSelection(member.id)
                                  }
                                  className="h-4 w-4 rounded border-line text-primary focus:ring-2 focus:ring-primary"
                                />
                              </td>
                              <td className="px-3 py-3 font-medium text-text-primary">
                                {member.full_name || "未填姓名"}
                              </td>
                              <td className="px-3 py-3 text-text-secondary">
                                {member.student_id || "未填學號"}
                              </td>
                              <td className="px-3 py-3 text-text-secondary">
                                {member.email}
                              </td>
                              <td className="px-3 py-3">
                                <SurfLevelBadge level={member.surf_level} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-3 md:hidden">
                      {filteredPendingMembers.map((member) => (
                        <label
                          key={member.id}
                          className="flex min-h-11 items-start gap-3 rounded-xl border border-line bg-appBg p-3"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPendingIds.has(member.id)}
                            onChange={() => togglePendingSelection(member.id)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-primary focus:ring-2 focus:ring-primary"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary">
                              {member.full_name || "未填姓名"}
                            </p>
                            <p className="mt-0.5 text-xs text-text-secondary">
                              學號：{member.student_id || "未填學號"}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-text-secondary">
                              {member.email}
                            </p>
                            <div className="mt-1.5">
                              <SurfLevelBadge level={member.surf_level} />
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <Button
                      variant="primary"
                      fullWidth
                      className="mt-4 sm:w-auto"
                      icon={<Check size={16} />}
                      onClick={() => void handleApprovePendingMembers()}
                      disabled={
                        selectedPendingIds.size === 0 || isApprovingPending
                      }
                    >
                      {isApprovingPending ? "儲存中..." : "核准成為社員"}
                    </Button>
                  </>
                )}
              </Card>
            )}

            {canReviewSurfLevels && (
              <Card>
                <div className="mb-4 flex items-center gap-2">
                  <Gauge size={18} className="text-primary" />
                  <h2 className="font-semibold text-text-primary">程度審核</h2>
                </div>

                {surfLevelRequests.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    目前沒有程度審核申請。
                  </p>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-line bg-appBg text-xs text-text-secondary">
                            <th className="px-3 py-2 font-medium">姓名</th>
                            <th className="px-3 py-2 font-medium">學號</th>
                            <th className="px-3 py-2 font-medium">目前程度</th>
                            <th className="px-3 py-2 font-medium">申請程度</th>
                            <th className="px-3 py-2 font-medium">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {surfLevelRequests.map((member) => (
                            <tr
                              key={member.id}
                              className="border-b border-line last:border-b-0"
                            >
                              <td className="px-3 py-3 font-medium text-text-primary">
                                {member.full_name || "未填姓名"}
                              </td>
                              <td className="px-3 py-3 text-text-secondary">
                                {member.student_id || "未填學號"}
                              </td>
                              <td className="px-3 py-3">
                                <SurfLevelBadge level={member.surf_level} />
                              </td>
                              <td className="px-3 py-3">
                                <SurfLevelBadge
                                  level={member.requested_surf_level}
                                />
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    className="!min-h-9 !px-2.5 !py-1 !text-xs text-success"
                                    icon={<Check size={14} />}
                                    onClick={() =>
                                      void handleApproveSurfLevel(member.id)
                                    }
                                    disabled={
                                      reviewingSurfLevelUserId === member.id
                                    }
                                  >
                                    核准
                                  </Button>
                                  <Button
                                    variant="danger"
                                    className="!min-h-9 !px-2.5 !py-1 !text-xs"
                                    icon={<X size={14} />}
                                    onClick={() =>
                                      void handleRejectSurfLevel(member.id)
                                    }
                                    disabled={
                                      reviewingSurfLevelUserId === member.id
                                    }
                                  >
                                    拒絕
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-3 md:hidden">
                      {surfLevelRequests.map((member) => (
                        <div
                          key={member.id}
                          className="rounded-xl border border-line bg-appBg p-3"
                        >
                          <p className="font-medium text-text-primary">
                            {member.full_name || "未填姓名"}
                          </p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            學號：{member.student_id || "未填學號"}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                            <span>目前：</span>
                            <SurfLevelBadge level={member.surf_level} />
                            <span>申請：</span>
                            <SurfLevelBadge level={member.requested_surf_level} />
                          </div>
                          <div className="mt-3 flex gap-2 border-t border-line pt-3">
                            <Button
                              variant="outline"
                              fullWidth
                              className="text-success"
                              icon={<Check size={16} />}
                              onClick={() => void handleApproveSurfLevel(member.id)}
                              disabled={reviewingSurfLevelUserId === member.id}
                            >
                              核准
                            </Button>
                            <Button
                              variant="danger"
                              fullWidth
                              icon={<X size={16} />}
                              onClick={() => void handleRejectSurfLevel(member.id)}
                              disabled={reviewingSurfLevelUserId === member.id}
                            >
                              拒絕
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            )}
          </div>
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
