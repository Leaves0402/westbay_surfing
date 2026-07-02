"use client";

import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { canManageMemberRoles } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  profileSelectColumns,
  roleLabels,
  roleOptions,
  type Profile,
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

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [savingRoleUserId, setSavingRoleUserId] = useState<string | null>(null);

  const canManage = canManageMemberRoles(profile);

  const loadProfiles = useCallback(async () => {
    setIsLoadingMembers(true);
    setStatusMessage("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(profileSelectColumns)
      .order("created_at", { ascending: false });

    setIsLoadingMembers(false);

    if (error) {
      setStatusMessage(`讀取社員資料失敗：${error.message}`);
      return;
    }

    setProfiles((data ?? []) as Profile[]);
  }, [setStatusMessage]);

  useEffect(() => {
    if (!canManage) return;
    queueMicrotask(() => void loadProfiles());
  }, [canManage, loadProfiles]);

  const handleUpdateRole = async (targetProfile: Profile, newRole: Role) => {
    if (!canManage) {
      setStatusMessage("只有幹部與管理員可以管理社員身份。");
      return;
    }

    if (targetProfile.id === user?.id) {
      setStatusMessage("不能在這裡調整自己的身份。");
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
      setStatusMessage(`更新社員身份失敗：${error.message}`);
      return;
    }

    setStatusMessage("社員身份已更新。");
    await loadProfiles();
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
          <h1 className="text-2xl font-semibold tracking-normal">
            社員身分管理
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            只有幹部與管理員可以進入這頁。實際更新權限仍以 Supabase RLS 為準。
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
              請先登入後再管理社員身份。
            </p>
          </section>
        ) : !canManage ? (
          <section className="border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-semibold text-amber-950">沒有管理權限</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              只有幹部與管理員可以使用社員身分管理頁。
            </p>
          </section>
        ) : (
          <section className="border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-semibold">社員列表</h2>
              <button
                type="button"
                onClick={() => void loadProfiles()}
                className="border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                重新整理
              </button>
            </div>

            {isLoadingMembers ? (
              <p className="text-sm text-slate-600">正在讀取社員資料...</p>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-slate-600">目前沒有社員資料。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-3 pr-4 font-medium">姓名</th>
                      <th className="py-3 pr-4 font-medium">學號</th>
                      <th className="py-3 pr-4 font-medium">Email</th>
                      <th className="py-3 pr-4 font-medium">衝浪程度</th>
                      <th className="py-3 pr-4 font-medium">身份</th>
                    </tr>
                  </thead>

                  <tbody>
                    {profiles.map((member) => (
                      <tr key={member.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4">
                          {member.full_name || "未填寫"}
                        </td>
                        <td className="py-3 pr-4">
                          {member.student_id || "未填寫"}
                        </td>
                        <td className="py-3 pr-4">{member.email}</td>
                        <td className="py-3 pr-4">
                          <SurfLevelBadge level={member.surf_level} />
                        </td>
                        <td className="py-3 pr-4">
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
              </div>
            )}
          </section>
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
