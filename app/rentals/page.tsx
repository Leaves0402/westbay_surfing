"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import {
  SurfLevelBadge,
  surfLevelBorderClasses,
} from "@/components/SurfLevelBadge";
import {
  canManageRentalPayments,
  canManageRentalSlots,
  canViewRentals,
  userMeetsSurfLevel,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  roleLabels,
  surfLevelDescriptions,
  type Profile,
  type PublicMemberProfile,
  type RentalRegistration,
  type RentalSlot,
  type SurfLevel,
} from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

type ResponsibleProfile = Pick<
  Profile,
  "id" | "email" | "full_name" | "student_id" | "surf_level" | "role"
>;

function getTodayDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function parseLocalDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`);
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString: string) {
  return parseLocalDate(dateString).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
  });
}

function formatTime(timeString: string) {
  return timeString.slice(0, 5);
}

function getCalendarCells(monthCursor: Date) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      date,
      dateString: toDateString(date),
      isCurrentMonth: date.getMonth() === month,
    };
  });
}

function getSlotBorderClass(slot: RentalSlot) {
  if (!slot.min_surf_level) return "border-slate-300";
  return (
    surfLevelBorderClasses[slot.min_surf_level as SurfLevel] ??
    "border-slate-300"
  );
}

function formatResponsiblePerson(
  person: ResponsibleProfile | PublicMemberProfile | null,
  emptyText = "未指定負責人"
) {
  if (!person) return emptyText;
  const name =
    person.full_name ||
    ("email" in person ? person.email : null) ||
    "未填姓名";
  return `${roleLabels[person.role]}（${name}）`;
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
  const [staffProfiles, setStaffProfiles] = useState<ResponsibleProfile[]>([]);
  const [monthCursor, setMonthCursor] = useState(() =>
    parseLocalDate(getTodayDate())
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
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
  const [updatingPaymentRegistrationId, setUpdatingPaymentRegistrationId] =
    useState<string | null>(null);

  const [newSlotDate, setNewSlotDate] = useState(getTodayDate());
  const [newSlotStartTime, setNewSlotStartTime] = useState("15:00");
  const [newSlotEndTime, setNewSlotEndTime] = useState("17:00");
  const [newSlotCapacity, setNewSlotCapacity] = useState("5");
  const [newSlotBoardManagerId, setNewSlotBoardManagerId] = useState("");
  const [newSlotMinSurfLevel, setNewSlotMinSurfLevel] = useState("");
  const [newSlotNote, setNewSlotNote] = useState("");

  const canView = canViewRentals(profile);
  const canManageSlots = canManageRentalSlots(profile);
  const canManagePayments = canManageRentalPayments(profile);

  const calendarCells = useMemo(
    () => getCalendarCells(monthCursor),
    [monthCursor]
  );

  const selectedSlot = useMemo(
    () => rentalSlots.find((slot) => slot.id === selectedSlotId) ?? null,
    [rentalSlots, selectedSlotId]
  );

  const getPublicProfileById = useCallback(
    (profileId: string | null) => {
      if (!profileId) return null;
      return memberProfiles.find((member) => member.id === profileId) ?? null;
    },
    [memberProfiles]
  );

  const getResponsibleProfileById = useCallback(
    (profileId: string | null) => {
      if (!profileId) return null;
      return (
        staffProfiles.find((staff) => staff.id === profileId) ??
        getPublicProfileById(profileId)
      );
    },
    [getPublicProfileById, staffProfiles]
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
        .select("id, rental_slot_id, user_id, is_paid, created_at, updated_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("public_member_profiles")
        .select("id, full_name, student_id, surf_level, role"),
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

    if (canManageSlots) {
      const staffResult = await supabase
        .from("profiles")
        .select("id, email, full_name, student_id, surf_level, role")
        .in("role", ["board_manager", "officer", "admin"])
        .order("role", { ascending: true })
        .order("full_name", { ascending: true });

      if (staffResult.error) {
        setStatusMessage(`讀取負責人名單失敗：${staffResult.error.message}`);
        return;
      }

      setStaffProfiles((staffResult.data ?? []) as ResponsibleProfile[]);
    } else {
      setStaffProfiles([]);
    }
  }, [canManageSlots, setStatusMessage]);

  useEffect(() => {
    if (!canView) return;
    queueMicrotask(() => void loadRentalData());
  }, [canView, loadRentalData]);

  const isSlotFull = (slot: RentalSlot) => {
    return getSlotRegistrations(slot.id).length >= slot.capacity;
  };

  const moveMonth = (offset: number) => {
    setMonthCursor(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1)
    );
  };

  const handleCreateRentalSlot = async () => {
    if (!user) {
      setStatusMessage("請先登入後再新增租板時段。");
      return;
    }

    if (!canManageSlots) {
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
    setMonthCursor(parseLocalDate(newSlotDate));
    setStatusMessage("租板時段已新增。");
    await loadRentalData();
  };

  const handleToggleRentalSlot = async (slot: RentalSlot) => {
    if (!canManageSlots) {
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
    if (!canManageSlots) {
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

    if (selectedSlotId === slotId) {
      setSelectedSlotId(null);
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
      is_paid: false,
    });

    setSavingRegistrationSlotId(null);

    if (error) {
      setStatusMessage(`登記租板失敗：${error.message}`);
      return;
    }

    setSelectedSlotId(slot.id);
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

    if (registration.user_id !== user.id && !canManageSlots) {
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

  const handleTogglePayment = async (
    registration: RentalRegistration,
    isPaid: boolean
  ) => {
    if (!canManagePayments) {
      setStatusMessage("只有板務、幹部與管理員可以更新繳費狀態。");
      return;
    }

    setUpdatingPaymentRegistrationId(registration.id);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase
      .from("rental_registrations")
      .update({
        is_paid: isPaid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", registration.id);

    setUpdatingPaymentRegistrationId(null);

    if (error) {
      setStatusMessage(`更新繳費狀態失敗：${error.message}`);
      return;
    }

    setRentalRegistrations((current) =>
      current.map((item) =>
        item.id === registration.id ? { ...item, is_paid: isPaid } : item
      )
    );
    setStatusMessage("繳費狀態已更新。");
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

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="mb-6 border border-slate-200 bg-white p-5">
          <h1 className="text-2xl font-semibold tracking-normal">租板</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            社員以上可以查看與登記；板務、幹部與管理員可以新增、開關、刪除時段並管理繳費狀態。
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
            {canManageSlots && (
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
                    <span className="text-sm font-medium">負責人</span>
                    <select
                      value={newSlotBoardManagerId}
                      onChange={(event) =>
                        setNewSlotBoardManagerId(event.target.value)
                      }
                      className="border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                    >
                      <option value="">未指定負責人</option>
                      {staffProfiles.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {formatResponsiblePerson(staff, "未填姓名")}
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

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
              <div className="border border-slate-200 bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">租板日曆</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      點擊日期格中的時段查看詳細資料。
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveMonth(-1)}
                      className="border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      上個月
                    </button>
                    <p className="min-w-28 text-center text-sm font-semibold">
                      {formatMonth(monthCursor)}
                    </p>
                    <button
                      type="button"
                      onClick={() => moveMonth(1)}
                      className="border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      下個月
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadRentalData()}
                      className="border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      重新整理
                    </button>
                  </div>
                </div>

                {isLoadingRentals ? (
                  <p className="border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    正在讀取租板資料...
                  </p>
                ) : (
                  <div className="grid grid-cols-7 border-l border-t border-slate-200">
                    {weekdayLabels.map((weekday) => (
                      <div
                        key={weekday}
                        className="border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-700"
                      >
                        {weekday}
                      </div>
                    ))}

                    {calendarCells.map((cell) => {
                      const slotsForDay = rentalSlots.filter(
                        (slot) => slot.rental_date === cell.dateString
                      );

                      return (
                        <div
                          key={cell.dateString}
                          className={`min-h-36 border-b border-r border-slate-200 p-2 ${
                            cell.isCurrentMonth ? "bg-white" : "bg-slate-50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (slotsForDay[0]) {
                                setSelectedSlotId(slotsForDay[0].id);
                              }
                            }}
                            className={`mb-2 block text-left text-sm font-semibold text-black ${
                              cell.isCurrentMonth ? "" : "opacity-45"
                            }`}
                          >
                            {cell.date.getDate()}
                          </button>

                          <div className="grid gap-2">
                            {slotsForDay.map((slot) => {
                              const registrations = getSlotRegistrations(slot.id);
                              const responsiblePerson = getResponsibleProfileById(
                                slot.board_manager_id
                              );
                              const meetsLevel = userMeetsSurfLevel(
                                profile,
                                slot.min_surf_level
                              );
                              const isAvailableForUser =
                                slot.is_open && meetsLevel;
                              const borderClass = getSlotBorderClass(slot);
                              const isSelected = selectedSlotId === slot.id;

                              return (
                                <button
                                  type="button"
                                  key={slot.id}
                                  onClick={() => setSelectedSlotId(slot.id)}
                                  className={`border-2 ${borderClass} ${
                                    isAvailableForUser
                                      ? "bg-white"
                                      : "bg-slate-100"
                                  } p-2 text-left text-xs text-black hover:bg-blue-50 ${
                                    isSelected
                                      ? "outline outline-2 outline-blue-500"
                                      : ""
                                  }`}
                                >
                                  <p className="font-semibold">
                                    {formatTime(slot.start_time)}-
                                    {formatTime(slot.end_time)}
                                  </p>
                                  <p className="mt-1">
                                    {registrations.length}/{slot.capacity}
                                  </p>
                                  <p className="mt-1">
                                    {slot.min_surf_level
                                      ? `${slot.min_surf_level}以上`
                                      : "不限制程度"}
                                  </p>
                                  <p
                                    className={`mt-1 ${
                                      responsiblePerson
                                        ? "text-black"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {formatResponsiblePerson(responsiblePerson)}
                                  </p>
                                  {!slot.is_open && (
                                    <p className="mt-1 text-slate-600">未開放</p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                {selectedSlot ? (
                  <RentalSlotDetail
                    slot={selectedSlot}
                    userId={user.id}
                    profile={profile}
                    registrations={getSlotRegistrations(selectedSlot.id)}
                    boardManager={getResponsibleProfileById(
                      selectedSlot.board_manager_id
                    )}
                    getPublicProfileById={getPublicProfileById}
                    myRegistration={getMyRegistration(selectedSlot.id)}
                    isFull={isSlotFull(selectedSlot)}
                    canManageSlots={canManageSlots}
                    canManagePayments={canManagePayments}
                    updatingRentalSlotId={updatingRentalSlotId}
                    deletingRentalSlotId={deletingRentalSlotId}
                    savingRegistrationSlotId={savingRegistrationSlotId}
                    updatingPaymentRegistrationId={updatingPaymentRegistrationId}
                    onToggleSlot={handleToggleRentalSlot}
                    onDeleteSlot={handleDeleteRentalSlot}
                    onRegister={handleRegisterRental}
                    onCancelRegistration={handleCancelRentalRegistration}
                    onTogglePayment={handleTogglePayment}
                  />
                ) : (
                  <section className="border border-slate-200 bg-white p-5">
                    <h2 className="font-semibold">時段詳細資料</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      請從左側日曆選擇一個租板時段。
                    </p>
                  </section>
                )}
              </div>
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

function RentalSlotDetail({
  slot,
  userId,
  profile,
  registrations,
  boardManager,
  getPublicProfileById,
  myRegistration,
  isFull,
  canManageSlots,
  canManagePayments,
  updatingRentalSlotId,
  deletingRentalSlotId,
  savingRegistrationSlotId,
  updatingPaymentRegistrationId,
  onToggleSlot,
  onDeleteSlot,
  onRegister,
  onCancelRegistration,
  onTogglePayment,
}: {
  slot: RentalSlot;
  userId: string;
  profile: { surf_level: string | null } | null;
  registrations: RentalRegistration[];
  boardManager: ResponsibleProfile | PublicMemberProfile | null;
  getPublicProfileById: (profileId: string | null) => PublicMemberProfile | null;
  myRegistration: RentalRegistration | null;
  isFull: boolean;
  canManageSlots: boolean;
  canManagePayments: boolean;
  updatingRentalSlotId: string | null;
  deletingRentalSlotId: string | null;
  savingRegistrationSlotId: string | null;
  updatingPaymentRegistrationId: string | null;
  onToggleSlot: (slot: RentalSlot) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
  onRegister: (slot: RentalSlot) => Promise<void>;
  onCancelRegistration: (registration: RentalRegistration) => Promise<void>;
  onTogglePayment: (
    registration: RentalRegistration,
    isPaid: boolean
  ) => Promise<void>;
}) {
  const meetsLevel = userMeetsSurfLevel(profile, slot.min_surf_level);
  const canRegister =
    slot.is_open && !isFull && !myRegistration && meetsLevel;
  const registrationRows = Array.from(
    { length: Math.max(slot.capacity, registrations.length) },
    (_, index) => registrations[index] ?? null
  );

  return (
    <section className="border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">時段詳細資料</h2>
          <p className="mt-1 text-sm text-slate-600">{formatDate(slot.rental_date)}</p>
        </div>

        {canManageSlots && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onToggleSlot(slot)}
              disabled={updatingRentalSlotId === slot.id}
              className="border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {updatingRentalSlotId === slot.id
                ? "更新中..."
                : slot.is_open
                  ? "關閉"
                  : "開放"}
            </button>

            <button
              type="button"
              onClick={() => void onDeleteSlot(slot.id)}
              disabled={deletingRentalSlotId === slot.id}
              className="border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {deletingRentalSlotId === slot.id ? "刪除中..." : "刪除"}
            </button>
          </div>
        )}
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">時間</dt>
          <dd className="mt-1 font-medium">
            {formatTime(slot.start_time)}-{formatTime(slot.end_time)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">開放狀態</dt>
          <dd className="mt-1 font-medium">{slot.is_open ? "開放中" : "已關閉"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">負責人</dt>
          <dd className={boardManager ? "mt-1 font-medium" : "mt-1 text-slate-500"}>
            {formatResponsiblePerson(boardManager)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">最低程度</dt>
          <dd className="mt-1 font-medium">
            {slot.min_surf_level ? (
              <span className="inline-flex items-center gap-2">
                <SurfLevelBadge level={slot.min_surf_level} />
                <span>以上</span>
              </span>
            ) : (
              "不限制"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">名額</dt>
          <dd className="mt-1 font-medium">
            {registrations.length}/{slot.capacity}
          </dd>
        </div>
      </dl>

      {slot.note && (
        <p className="mt-5 whitespace-pre-wrap border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          備註：{slot.note}
        </p>
      )}

      <div className="mt-5 overflow-x-auto">
        <h3 className="mb-3 font-semibold">登記名單</h3>
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 pr-3 font-medium">編號</th>
              <th className="py-2 pr-3 font-medium">姓名</th>
              <th className="py-2 pr-3 font-medium">學號</th>
              <th className="py-2 pr-3 font-medium">衝浪程度</th>
              <th className="py-2 pr-3 font-medium">繳費</th>
              <th className="py-2 pr-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {registrationRows.map((registration, index) => {
              const renter = registration
                ? getPublicProfileById(registration.user_id)
                : null;

              return (
                <tr
                  key={registration?.id ?? `empty-${slot.id}-${index}`}
                  className="border-b border-slate-100"
                >
                  <td className="py-3 pr-3">{index + 1}</td>
                  <td className="py-3 pr-3">
                    {registration ? renter?.full_name || "未填姓名" : "空位"}
                  </td>
                  <td className="py-3 pr-3">
                    {registration ? renter?.student_id || "未填學號" : "-"}
                  </td>
                  <td className="py-3 pr-3">
                    {registration ? (
                      <SurfLevelBadge level={renter?.surf_level ?? null} />
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {registration ? (
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={registration.is_paid}
                          disabled={
                            !canManagePayments ||
                            updatingPaymentRegistrationId === registration.id
                          }
                          onChange={(event) =>
                            void onTogglePayment(
                              registration,
                              event.target.checked
                            )
                          }
                        />
                        <span>{registration.is_paid ? "已繳" : "未繳"}</span>
                      </label>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {registration &&
                    (registration.user_id === userId || canManageSlots) ? (
                      <button
                        type="button"
                        onClick={() => void onCancelRegistration(registration)}
                        disabled={savingRegistrationSlotId === slot.id}
                        className="text-sm font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        取消登記
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        {myRegistration ? (
          <button
            type="button"
            onClick={() => void onCancelRegistration(myRegistration)}
            disabled={savingRegistrationSlotId === slot.id}
            className="border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {savingRegistrationSlotId === slot.id ? "取消中..." : "取消我的登記"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onRegister(slot)}
            disabled={!canRegister || savingRegistrationSlotId === slot.id}
            className="bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {savingRegistrationSlotId === slot.id ? "登記中..." : "登記租板"}
          </button>
        )}

        {!slot.is_open && (
          <p className="mt-2 text-xs text-slate-500">此時段目前未開放登記。</p>
        )}

        {slot.is_open && isFull && (
          <p className="mt-2 text-xs text-slate-500">此時段已額滿。</p>
        )}

        {slot.is_open && !meetsLevel && (
          <p className="mt-2 text-xs text-slate-500">
            你的衝浪程度尚未符合此時段最低要求。
          </p>
        )}
      </div>
    </section>
  );
}
