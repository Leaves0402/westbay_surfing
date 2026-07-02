"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import {
  canManageRentalSlots,
  canViewRentals,
  userMeetsSurfLevel,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  roleLabels,
  surfLevelDescriptions,
  type PublicMemberProfile,
  type RentalRegistration,
  type RentalSlot,
} from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

function getTodayDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function formatDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function formatTime(timeString: string) {
  return timeString.slice(0, 5);
}

export default function RentalsPage() {
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    setStatusMessage,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

  const [rentalSlots, setRentalSlots] = useState<RentalSlot[]>([]);
  const [rentalRegistrations, setRentalRegistrations] = useState<
    RentalRegistration[]
  >([]);
  const [memberProfiles, setMemberProfiles] = useState<PublicMemberProfile[]>(
    []
  );
  const [isLoadingRentals, setIsLoadingRentals] = useState(false);
  const [isCreatingRentalSlot, setIsCreatingRentalSlot] = useState(false);
  const [updatingRentalSlotId, setUpdatingRentalSlotId] = useState<
    string | null
  >(null);
  const [deletingRentalSlotId, setDeletingRentalSlotId] = useState<
    string | null
  >(null);
  const [savingRegistrationSlotId, setSavingRegistrationSlotId] = useState<
    string | null
  >(null);

  const [newSlotDate, setNewSlotDate] = useState(getTodayDate());
  const [newSlotStartTime, setNewSlotStartTime] = useState("15:00");
  const [newSlotEndTime, setNewSlotEndTime] = useState("17:00");
  const [newSlotCapacity, setNewSlotCapacity] = useState("5");
  const [newSlotBoardManagerId, setNewSlotBoardManagerId] = useState("");
  const [newSlotMinSurfLevel, setNewSlotMinSurfLevel] = useState("");
  const [newSlotNote, setNewSlotNote] = useState("");

  const canView = canViewRentals(profile);
  const canManage = canManageRentalSlots(profile);

  const staffProfiles = useMemo(
    () =>
      memberProfiles.filter((member) =>
        ["board_manager", "officer", "admin"].includes(member.role)
      ),
    [memberProfiles]
  );

  const slotDates = useMemo(
    () => Array.from(new Set(rentalSlots.map((slot) => slot.rental_date))).sort(),
    [rentalSlots]
  );

  const getPublicProfileById = useCallback(
    (profileId: string | null) => {
      if (!profileId) return null;
      return memberProfiles.find((member) => member.id === profileId) ?? null;
    },
    [memberProfiles]
  );

  const getSlotRegistrations = useCallback(
    (slotId: string) =>
      rentalRegistrations.filter(
        (registration) => registration.rental_slot_id === slotId
      ),
    [rentalRegistrations]
  );

  const getMyRegistration = useCallback(
    (slotId: string) => {
      if (!user) return null;

      return (
        rentalRegistrations.find(
          (registration) =>
            registration.rental_slot_id === slotId &&
            registration.user_id === user.id
        ) ?? null
      );
    },
    [rentalRegistrations, user]
  );

  const loadRentalData = useCallback(async () => {
    setIsLoadingRentals(true);
    setStatusMessage("");

    const supabase = createClient();
    const [slotsResult, registrationsResult, membersResult] = await Promise.all([
      supabase
        .from("rental_slots")
        .select(
          "id, rental_date, start_time, end_time, capacity, board_manager_id, min_surf_level, note, is_open, created_by, created_at, updated_at"
        )
        .order("rental_date", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("rental_registrations")
        .select("id, rental_slot_id, user_id, created_at, updated_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("public_member_profiles")
        .select("id, full_name, surf_level, role"),
    ]);

    setIsLoadingRentals(false);

    if (slotsResult.error) {
      setStatusMessage(`讀取租板時段失敗：${slotsResult.error.message}`);
      return;
    }

    if (registrationsResult.error) {
      setStatusMessage(`讀取租板登記失敗：${registrationsResult.error.message}`);
      return;
    }

    if (membersResult.error) {
      setStatusMessage(`讀取社員公開資料失敗：${membersResult.error.message}`);
      return;
    }

    setRentalSlots((slotsResult.data ?? []) as RentalSlot[]);
    setRentalRegistrations(
      (registrationsResult.data ?? []) as RentalRegistration[]
    );
    setMemberProfiles((membersResult.data ?? []) as PublicMemberProfile[]);
  }, [setStatusMessage]);

  useEffect(() => {
    if (!canView) return;
    queueMicrotask(() => void loadRentalData());
  }, [canView, loadRentalData]);

  const isSlotFull = (slot: RentalSlot) => {
    return getSlotRegistrations(slot.id).length >= slot.capacity;
  };

  const handleCreateRentalSlot = async () => {
    if (!user) {
      setStatusMessage("請先登入後再新增租板時段。");
      return;
    }

    if (!canManage) {
      setStatusMessage("只有板務、幹部與管理員可以新增租板時段。");
      return;
    }

    if (!newSlotDate) {
      setStatusMessage("請選擇日期。");
      return;
    }

    if (!newSlotStartTime || !newSlotEndTime) {
      setStatusMessage("請填寫開始與結束時間。");
      return;
    }

    if (newSlotStartTime >= newSlotEndTime) {
      setStatusMessage("結束時間必須晚於開始時間。");
      return;
    }

    const capacity = Number(newSlotCapacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      setStatusMessage("人數上限必須是大於 0 的整數。");
      return;
    }

    setIsCreatingRentalSlot(true);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.from("rental_slots").insert({
      rental_date: newSlotDate,
      start_time: newSlotStartTime,
      end_time: newSlotEndTime,
      capacity,
      board_manager_id: newSlotBoardManagerId || null,
      min_surf_level: newSlotMinSurfLevel || null,
      note: newSlotNote.trim() || null,
      is_open: true,
      created_by: user.id,
    });

    setIsCreatingRentalSlot(false);

    if (error) {
      setStatusMessage(`新增租板時段失敗：${error.message}`);
      return;
    }

    setNewSlotDate(getTodayDate());
    setNewSlotStartTime("15:00");
    setNewSlotEndTime("17:00");
    setNewSlotCapacity("5");
    setNewSlotBoardManagerId("");
    setNewSlotMinSurfLevel("");
    setNewSlotNote("");
    setStatusMessage("租板時段已新增。");
    await loadRentalData();
  };

  const handleToggleRentalSlot = async (slot: RentalSlot) => {
    if (!canManage) {
      setStatusMessage("只有板務、幹部與管理員可以開關租板時段。");
      return;
    }

    setUpdatingRentalSlotId(slot.id);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase
      .from("rental_slots")
      .update({
        is_open: !slot.is_open,
        updated_at: new Date().toISOString(),
      })
      .eq("id", slot.id);

    setUpdatingRentalSlotId(null);

    if (error) {
      setStatusMessage(`更新租板時段失敗：${error.message}`);
      return;
    }

    setStatusMessage(slot.is_open ? "租板時段已關閉。" : "租板時段已開放。");
    await loadRentalData();
  };

  const handleDeleteRentalSlot = async (slotId: string) => {
    if (!canManage) {
      setStatusMessage("只有板務、幹部與管理員可以刪除租板時段。");
      return;
    }

    const confirmed = window.confirm("確定要刪除這個租板時段嗎？");
    if (!confirmed) return;

    setDeletingRentalSlotId(slotId);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.from("rental_slots").delete().eq("id", slotId);

    setDeletingRentalSlotId(null);

    if (error) {
      setStatusMessage(`刪除租板時段失敗：${error.message}`);
      return;
    }

    setStatusMessage("租板時段已刪除。");
    await loadRentalData();
  };

  const handleRegisterRental = async (slot: RentalSlot) => {
    if (!user) {
      setStatusMessage("請先登入後再登記租板。");
      return;
    }

    if (!canView) {
      setStatusMessage("目前身份尚未開通租板權限。");
      return;
    }

    if (!slot.is_open) {
      setStatusMessage("這個租板時段目前未開放。");
      return;
    }

    if (isSlotFull(slot)) {
      setStatusMessage("這個租板時段已額滿。");
      return;
    }

    if (!userMeetsSurfLevel(profile, slot.min_surf_level)) {
      setStatusMessage("你的衝浪程度尚未符合此時段最低要求。");
      return;
    }

    setSavingRegistrationSlotId(slot.id);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.from("rental_registrations").insert({
      rental_slot_id: slot.id,
      user_id: user.id,
    });

    setSavingRegistrationSlotId(null);

    if (error) {
      setStatusMessage(`登記租板失敗：${error.message}`);
      return;
    }

    setStatusMessage("已登記租板。");
    await loadRentalData();
  };

  const handleCancelRentalRegistration = async (
    registration: RentalRegistration
  ) => {
    if (!user) {
      setStatusMessage("請先登入。");
      return;
    }

    if (registration.user_id !== user.id && !canManage) {
      setStatusMessage("只能取消自己的登記。");
      return;
    }

    setSavingRegistrationSlotId(registration.rental_slot_id);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase
      .from("rental_registrations")
      .delete()
      .eq("id", registration.id);

    setSavingRegistrationSlotId(null);

    if (error) {
      setStatusMessage(`取消登記失敗：${error.message}`);
      return;
    }

    setStatusMessage("已取消登記。");
    await loadRentalData();
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
          <h1 className="text-2xl font-semibold tracking-normal">租板</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            社員以上可以查看與登記；板務、幹部與管理員可以新增、開關、刪除時段並查看登記名單。
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
              請先登入後再查看租板資訊。
            </p>
          </section>
        ) : !canView ? (
          <section className="border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-semibold text-amber-950">尚未開通租板權限</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              目前身份只能登入與填寫資料，請等待幹部或管理員審核。
            </p>
          </section>
        ) : (
          <>
            {canManage && (
              <section className="mb-6 border border-slate-200 bg-white p-5">
                <h2 className="font-semibold">新增租板時段</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-sm font-medium">日期</span>
                    <input
                      type="date"
                      value={newSlotDate}
                      onChange={(event) => setNewSlotDate(event.target.value)}
                      className="border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">人數上限</span>
                    <input
                      type="number"
                      min="1"
                      value={newSlotCapacity}
                      onChange={(event) =>
                        setNewSlotCapacity(event.target.value)
                      }
                      className="border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">開始時間</span>
                    <input
                      type="time"
                      value={newSlotStartTime}
                      onChange={(event) =>
                        setNewSlotStartTime(event.target.value)
                      }
                      className="border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">結束時間</span>
                    <input
                      type="time"
                      value={newSlotEndTime}
                      onChange={(event) =>
                        setNewSlotEndTime(event.target.value)
                      }
                      className="border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">負責板務</span>
                    <select
                      value={newSlotBoardManagerId}
                      onChange={(event) =>
                        setNewSlotBoardManagerId(event.target.value)
                      }
                      className="border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    >
                      <option value="">未指定</option>
                      {staffProfiles.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name || "未填姓名"}（
                          {roleLabels[staff.role]}）
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">最低衝浪程度</span>
                    <select
                      value={newSlotMinSurfLevel}
                      onChange={(event) =>
                        setNewSlotMinSurfLevel(event.target.value)
                      }
                      className="border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    >
                      <option value="">不限制</option>
                      {surfLevelDescriptions.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.title}以上
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-sm font-medium">備註</span>
                    <textarea
                      value={newSlotNote}
                      onChange={(event) => setNewSlotNote(event.target.value)}
                      className="min-h-20 border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                      placeholder="例如集合地點、浪況提醒或其他注意事項"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreateRentalSlot()}
                  disabled={isCreatingRentalSlot}
                  className="mt-4 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isCreatingRentalSlot ? "新增中..." : "新增租板時段"}
                </button>
              </section>
            )}

            <section className="grid gap-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-semibold">租板時段</h2>
                <button
                  type="button"
                  onClick={() => void loadRentalData()}
                  className="border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                >
                  重新整理
                </button>
              </div>

              {isLoadingRentals ? (
                <p className="border border-slate-200 bg-white p-5 text-sm text-slate-600">
                  正在讀取租板資料...
                </p>
              ) : rentalSlots.length === 0 ? (
                <p className="border border-slate-200 bg-white p-5 text-sm text-slate-600">
                  目前沒有租板時段。
                </p>
              ) : (
                slotDates.map((date) => (
                  <section key={date} className="border border-slate-200 bg-white p-5">
                    <h3 className="mb-4 font-semibold">{formatDate(date)}</h3>

                    <div className="grid gap-4">
                      {rentalSlots
                        .filter((slot) => slot.rental_date === date)
                        .map((slot) => {
                          const registrations = getSlotRegistrations(slot.id);
                          const boardManager = getPublicProfileById(
                            slot.board_manager_id
                          );
                          const myRegistration = getMyRegistration(slot.id);
                          const full = isSlotFull(slot);
                          const meetsLevel = userMeetsSurfLevel(
                            profile,
                            slot.min_surf_level
                          );
                          const canRegister =
                            slot.is_open &&
                            !full &&
                            !myRegistration &&
                            meetsLevel;

                          return (
                            <article
                              key={slot.id}
                              className="border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-semibold">
                                      {formatTime(slot.start_time)}-
                                      {formatTime(slot.end_time)}
                                    </h4>
                                    <span
                                      className={`px-2 py-1 text-xs font-medium ${
                                        slot.is_open
                                          ? "bg-green-100 text-green-700"
                                          : "bg-slate-200 text-slate-600"
                                      }`}
                                    >
                                      {slot.is_open ? "開放中" : "已關閉"}
                                    </span>
                                  </div>

                                  <div className="mt-3 grid gap-1 text-sm text-slate-600">
                                    <p>
                                      負責板務：
                                      {boardManager?.full_name || "未指定"}
                                    </p>
                                    <p>
                                      最低程度：
                                      {slot.min_surf_level ? (
                                        <span className="inline-flex items-center gap-2">
                                          <SurfLevelBadge
                                            level={slot.min_surf_level}
                                          />
                                          <span>以上</span>
                                        </span>
                                      ) : (
                                        "不限制"
                                      )}
                                    </p>
                                    <p>
                                      名額：{registrations.length} /{" "}
                                      {slot.capacity}
                                    </p>
                                  </div>

                                  {slot.note && (
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                      備註：{slot.note}
                                    </p>
                                  )}
                                </div>

                                {canManage && (
                                  <div className="flex shrink-0 flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleToggleRentalSlot(slot)
                                      }
                                      disabled={updatingRentalSlotId === slot.id}
                                      className="border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:text-slate-400"
                                    >
                                      {updatingRentalSlotId === slot.id
                                        ? "更新中..."
                                        : slot.is_open
                                          ? "關閉"
                                          : "開放"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleDeleteRentalSlot(slot.id)
                                      }
                                      disabled={deletingRentalSlotId === slot.id}
                                      className="border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                    >
                                      {deletingRentalSlotId === slot.id
                                        ? "刪除中..."
                                        : "刪除"}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {canManage && (
                                <div className="mt-4 border border-slate-200 bg-white p-3">
                                  <h5 className="mb-2 text-sm font-medium">
                                    登記名單
                                  </h5>

                                  <div className="grid gap-2">
                                    {registrations.length === 0 ? (
                                      <p className="text-sm text-slate-500">
                                        尚無登記。
                                      </p>
                                    ) : (
                                      registrations.map((registration) => {
                                        const renter = getPublicProfileById(
                                          registration.user_id
                                        );

                                        return (
                                          <div
                                            key={registration.id}
                                            className="flex flex-col gap-2 border border-slate-100 bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                                          >
                                            <div>
                                              <span className="font-medium">
                                                {renter?.full_name ||
                                                  "未填姓名"}
                                              </span>
                                              <span className="ml-3">
                                                <SurfLevelBadge
                                                  level={
                                                    renter?.surf_level ?? null
                                                  }
                                                />
                                              </span>
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() =>
                                                void handleCancelRentalRegistration(
                                                  registration
                                                )
                                              }
                                              disabled={
                                                savingRegistrationSlotId ===
                                                slot.id
                                              }
                                              className="w-fit text-sm font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                                            >
                                              取消登記
                                            </button>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="mt-4">
                                {myRegistration ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleCancelRentalRegistration(
                                        myRegistration
                                      )
                                    }
                                    disabled={
                                      savingRegistrationSlotId === slot.id
                                    }
                                    className="border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                  >
                                    {savingRegistrationSlotId === slot.id
                                      ? "取消中..."
                                      : "取消我的登記"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void handleRegisterRental(slot)}
                                    disabled={
                                      !canRegister ||
                                      savingRegistrationSlotId === slot.id
                                    }
                                    className="bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                  >
                                    {savingRegistrationSlotId === slot.id
                                      ? "登記中..."
                                      : "登記租板"}
                                  </button>
                                )}

                                {!slot.is_open && (
                                  <p className="mt-2 text-xs text-slate-500">
                                    此時段目前未開放登記。
                                  </p>
                                )}

                                {slot.is_open && full && (
                                  <p className="mt-2 text-xs text-slate-500">
                                    此時段已額滿。
                                  </p>
                                )}

                                {slot.is_open && !meetsLevel && (
                                  <p className="mt-2 text-xs text-slate-500">
                                    你的衝浪程度尚未符合此時段最低要求。
                                  </p>
                                )}
                              </div>
                            </article>
                          );
                        })}
                    </div>
                  </section>
                ))
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
