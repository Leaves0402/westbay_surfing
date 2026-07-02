"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
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
          <h1 className="text-2xl font-semibold tracking-normal">社員名單</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            社員可瀏覽正式成員名單；幹部與管理員可審核待審核社員、調整身分與處理程度申請。
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
              請先登入後再查看社員名單。
            </p>
          </section>
        ) : !canView ? (
          <section className="border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-semibold text-amber-950">尚未開通瀏覽權限</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              待審核身分只能登入與填寫基本資料，尚不能瀏覽社員名單。
            </p>
          </section>
        ) : (
          <div className="grid gap-6">
            <section className="border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="font-semibold">正式成員列表</h2>
                <button
                  type="button"
                  onClick={() => void loadMembers()}
                  className="border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  重新整理
                </button>
              </div>

              {isLoadingMembers ? (
                <p className="text-sm text-slate-600">正在讀取社員資料...</p>
              ) : sortedOfficialMembers.length === 0 ? (
                <p className="text-sm text-slate-600">目前沒有正式成員資料。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="py-3 pr-4 font-medium">姓名</th>
                        <th className="py-3 pr-4 font-medium">學號</th>
                        <th className="py-3 pr-4 font-medium">衝浪程度</th>
                        <th className="py-3 pr-4 font-medium">系統身分</th>
                      </tr>
                    </thead>

                    <tbody>
                      {sortedOfficialMembers.map((member) => (
                        <tr key={member.id} className="border-b border-slate-100">
                          <td className="py-3 pr-4">
                            {member.full_name || "未填姓名"}
                          </td>
                          <td className="py-3 pr-4">
                            {member.student_id || "未填學號"}
                          </td>
                          <td className="py-3 pr-4">
                            <SurfLevelBadge level={member.surf_level} />
                          </td>
                          <td className="py-3 pr-4">
                            {canManage ? (
                              <select
                                value={member.role}
                                disabled={
                                  member.id === user.id ||
                                  savingRoleUserId === member.id
                                }
                                onChange={(event) =>
                                  void handleUpdateRole(
                                    member,
                                    event.target.value as Role
                                  )
                                }
                                className="border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:bg-slate-100"
                              >
                                {officialMemberRoleOptions.map((role) => (
                                  <option key={role} value={role}>
                                    {roleLabels[role]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              roleLabels[member.role]
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {canReviewPending && (
              <section className="border border-slate-200 bg-white p-5">
                <h2 className="font-semibold">待審核名單</h2>

                {pendingMembers.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">
                    目前沒有待審核社員。
                  </p>
                ) : (
                  <>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="py-3 pr-4 font-medium">核准</th>
                            <th className="py-3 pr-4 font-medium">姓名</th>
                            <th className="py-3 pr-4 font-medium">學號</th>
                            <th className="py-3 pr-4 font-medium">Email</th>
                            <th className="py-3 pr-4 font-medium">衝浪程度</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingMembers.map((member) => (
                            <tr
                              key={member.id}
                              className="border-b border-slate-100"
                            >
                              <td className="py-3 pr-4">
                                <input
                                  type="checkbox"
                                  checked={selectedPendingIds.has(member.id)}
                                  onChange={() => togglePendingSelection(member.id)}
                                />
                              </td>
                              <td className="py-3 pr-4">
                                {member.full_name || "未填姓名"}
                              </td>
                              <td className="py-3 pr-4">
                                {member.student_id || "未填學號"}
                              </td>
                              <td className="py-3 pr-4">{member.email}</td>
                              <td className="py-3 pr-4">
                                <SurfLevelBadge level={member.surf_level} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleApprovePendingMembers()}
                      disabled={
                        selectedPendingIds.size === 0 || isApprovingPending
                      }
                      className="mt-4 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {isApprovingPending ? "儲存中..." : "核准成為社員"}
                    </button>
                  </>
                )}
              </section>
            )}

            {canReviewSurfLevels && (
              <section className="border border-slate-200 bg-white p-5">
                <h2 className="font-semibold">程度審核</h2>

                {surfLevelRequests.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">
                    目前沒有程度審核申請。
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-3 pr-4 font-medium">姓名</th>
                          <th className="py-3 pr-4 font-medium">學號</th>
                          <th className="py-3 pr-4 font-medium">目前程度</th>
                          <th className="py-3 pr-4 font-medium">申請程度</th>
                          <th className="py-3 pr-4 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {surfLevelRequests.map((member) => (
                          <tr
                            key={member.id}
                            className="border-b border-slate-100"
                          >
                            <td className="py-3 pr-4">
                              {member.full_name || "未填姓名"}
                            </td>
                            <td className="py-3 pr-4">
                              {member.student_id || "未填學號"}
                            </td>
                            <td className="py-3 pr-4">
                              <SurfLevelBadge level={member.surf_level} />
                            </td>
                            <td className="py-3 pr-4">
                              <SurfLevelBadge
                                level={member.requested_surf_level}
                              />
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleApproveSurfLevel(member.id)
                                  }
                                  disabled={reviewingSurfLevelUserId === member.id}
                                  className="border border-green-300 px-3 py-1 text-sm font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                >
                                  核准
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleRejectSurfLevel(member.id)
                                  }
                                  disabled={reviewingSurfLevelUserId === member.id}
                                  className="border border-red-300 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                >
                                  拒絕
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>
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
