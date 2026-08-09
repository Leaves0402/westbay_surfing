"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  Info,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog";
import { PublicRentalSchedule } from "@/components/rentals/PublicRentalSchedule";
import { SurfboardManager } from "@/components/rentals/SurfboardManager";
import { SurfboardPicker } from "@/components/rentals/SurfboardPicker";
import { SurfboardThumbnail } from "@/components/rentals/SurfboardThumbnail";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { getRoleTone, getSurfLevelTone, toneDotClasses } from "@/lib/badgeTones";
import {
  canBrowseSurfboards,
  canManageRentalSlots,
  canMarkRentalPaid,
  canViewRentals,
  canViewSurfboards,
  canViewUnpaidRentals,
  userMeetsSurfLevel,
} from "@/lib/permissions";
import {
  formatRentalDate as formatDate,
  formatRentalMonth as formatMonth,
  formatRentalShortDate as formatShortDate,
  formatRentalTime as formatTime,
  getCalendarCells,
  getTaipeiTodayDate,
  isRentalSlotExpired,
  isRentalSlotStartInFuture,
  parseLocalDate,
  toDateString,
  weekdayLabels,
} from "@/lib/rentalSlots";
import {
  createSignedSurfboardImageUrls,
  fetchSurfboards,
} from "@/lib/surfboards";
import { createClient } from "@/lib/supabase/client";
import {
  roleLabels,
  surfLevelDescriptions,
  type Profile,
  type PublicMemberProfile,
  type RentalRegistration,
  type RentalSlot,
  type SurfboardWithImages,
} from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

/** 畫面每 30 秒重新評估過期狀態，跨過開始時間時不需重新整理。 */
const EXPIRATION_TICK_MS = 30_000;

type ResponsibleProfile = Pick<
  Profile,
  "id" | "email" | "full_name" | "student_id" | "surf_level" | "role"
>;

function SurfLevelPill({ level }: { level: string | null | undefined }) {
  if (!level) {
    return <span className="text-sm text-slate-400">未填寫</span>;
  }

  return <Badge tone={getSurfLevelTone(level)}>{level}</Badge>;
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
  return { role: person.role, name };
}

function ResponsiblePersonTag({
  person,
  emptyText = "未指定負責人",
}: {
  person: ResponsibleProfile | PublicMemberProfile | null;
  emptyText?: string;
}) {
  const info = formatResponsiblePerson(person, emptyText);

  if (typeof info === "string") {
    return <span className="text-sm text-slate-400">{info}</span>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={getRoleTone(info.role)}>{roleLabels[info.role]}</Badge>
      <span className="text-sm font-medium text-slate-700">{info.name}</span>
    </span>
  );
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
  const [surfboards, setSurfboards] = useState<SurfboardWithImages[]>([]);
  const [surfboardImageUrls, setSurfboardImageUrls] = useState<
    Record<string, string>
  >({});
  const [isLoadingSurfboards, setIsLoadingSurfboards] = useState(false);
  const [surfboardLoadError, setSurfboardLoadError] = useState("");
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() =>
    parseLocalDate(getTaipeiTodayDate())
  );
  const [currentTime, setCurrentTime] = useState(() => Date.now());
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

  const [newSlotDate, setNewSlotDate] = useState(getTaipeiTodayDate());
  const [newSlotStartTime, setNewSlotStartTime] = useState("15:00");
  const [newSlotEndTime, setNewSlotEndTime] = useState("17:00");
  const [newSlotCapacity, setNewSlotCapacity] = useState("5");
  const [newSlotBoardManagerId, setNewSlotBoardManagerId] = useState("");
  const [newSlotMinSurfLevel, setNewSlotMinSurfLevel] = useState("");
  const [newSlotNote, setNewSlotNote] = useState("");

  // 負責人預設為目前登入者（等使用者資料載入後補上）。
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    queueMicrotask(() =>
      setNewSlotBoardManagerId((current) => current || userId)
    );
  }, [user]);

  // 頁面開著時定期更新現在時間，跨過開始時間會自動切成已過期。
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, EXPIRATION_TICK_MS);

    return () => clearInterval(timer);
  }, []);

  const canView = canViewRentals(profile);
  const canManageSlots = canManageRentalSlots(profile);
  const canViewUnpaid = canViewUnpaidRentals(profile);
  const canMarkPaid = canMarkRentalPaid(profile);
  const canSeeSurfboards = canViewSurfboards(profile);
  const canPickSurfboards = canBrowseSurfboards(profile);

  const today = getTaipeiTodayDate(currentTime);

  const isSlotExpired = useCallback(
    (slot: Pick<RentalSlot, "rental_date" | "start_time">) =>
      isRentalSlotExpired(slot, currentTime),
    [currentTime]
  );

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

  const getSurfboardById = useCallback(
    (surfboardId: string | null) => {
      if (!surfboardId) return null;
      return surfboards.find((board) => board.id === surfboardId) ?? null;
    },
    [surfboards]
  );

  /** 同一時段中已被選走的板子，用來停用挑板卡片。 */
  const getTakenSurfboardIds = useCallback(
    (slotId: string) =>
      rentalRegistrations
        .filter(
          (registration) =>
            registration.rental_slot_id === slotId &&
            registration.surfboard_id !== null
        )
        .map((registration) => registration.surfboard_id as string),
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

  const myUnpaidCount = useMemo(() => {
    if (!user) return 0;

    return rentalRegistrations.filter((registration) => {
      if (registration.user_id !== user.id || registration.is_paid) {
        return false;
      }

      const slot = rentalSlots.find(
        (item) => item.id === registration.rental_slot_id
      );
      return slot ? isSlotExpired(slot) : false;
    }).length;
  }, [isSlotExpired, rentalRegistrations, rentalSlots, user]);

  const unpaidRegistrations = useMemo(() => {
    return rentalRegistrations
      .filter((registration) => {
        if (registration.is_paid) return false;
        const slot = rentalSlots.find(
          (item) => item.id === registration.rental_slot_id
        );
        return slot ? isSlotExpired(slot) : false;
      })
      .sort((a, b) => {
        const slotA = rentalSlots.find((item) => item.id === a.rental_slot_id);
        const slotB = rentalSlots.find((item) => item.id === b.rental_slot_id);
        if (!slotA || !slotB) return 0;

        const dateCompare = slotA.rental_date.localeCompare(slotB.rental_date);
        if (dateCompare !== 0) return dateCompare;
        return slotA.start_time.localeCompare(slotB.start_time);
      });
  }, [isSlotExpired, rentalRegistrations, rentalSlots]);

  const loadRentalData = useCallback(async () => {
    setIsLoadingRentals(true);
    setStatusMessage("");

    const supabase = createClient();
    const rangeStart = calendarCells[0]
      ? toDateString(calendarCells[0].date)
      : getTaipeiTodayDate();
    const lastCalendarCell = calendarCells[calendarCells.length - 1];
    const rangeEnd = lastCalendarCell
      ? toDateString(lastCalendarCell.date)
      : rangeStart;

    const [slotsResult, membersResult] = await Promise.all([
      supabase
        .from("rental_slots")
        .select(
          "id, rental_date, start_time, end_time, capacity, board_manager_id, min_surf_level, note, is_open, created_by, created_at, updated_at"
        )
        .gte("rental_date", rangeStart)
        .lte("rental_date", rangeEnd)
        .order("rental_date", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("public_member_profiles")
        .select("id, full_name, student_id, surf_level, role"),
    ]);

    if (slotsResult.error) {
      setIsLoadingRentals(false);
      setStatusMessage(`讀取租板時段失敗：${slotsResult.error.message}`);
      return;
    }

    if (membersResult.error) {
      setIsLoadingRentals(false);
      setStatusMessage(`讀取社員公開資料失敗：${membersResult.error.message}`);
      return;
    }

    const visibleSlots = (slotsResult.data ?? []) as RentalSlot[];
    const visibleSlotIds = visibleSlots.map((slot) => slot.id);
    const registrationColumns =
      "id, rental_slot_id, user_id, surfboard_id, is_paid, paid_at, paid_by, created_at, updated_at";
    const emptyResult = { data: [], error: null };

    let outstandingQuery = supabase
      .from("rental_registrations")
      .select(registrationColumns)
      .eq("is_paid", false)
      .order("created_at", { ascending: true });

    if (!canViewUnpaid && user) {
      outstandingQuery = outstandingQuery.eq("user_id", user.id);
    }

    const [visibleRegistrationsResult, outstandingRegistrationsResult] =
      await Promise.all([
        visibleSlotIds.length
          ? supabase
              .from("rental_registrations")
              .select(registrationColumns)
              .in("rental_slot_id", visibleSlotIds)
              .order("created_at", { ascending: true })
          : Promise.resolve(emptyResult),
        user ? outstandingQuery : Promise.resolve(emptyResult),
      ]);

    if (visibleRegistrationsResult.error) {
      setIsLoadingRentals(false);
      setStatusMessage(
        `讀取本月租板登記失敗：${visibleRegistrationsResult.error.message}`
      );
      return;
    }

    if (outstandingRegistrationsResult.error) {
      setIsLoadingRentals(false);
      setStatusMessage(
        `讀取未繳費紀錄失敗：${outstandingRegistrationsResult.error.message}`
      );
      return;
    }

    const registrationMap = new Map<string, RentalRegistration>();
    for (const registration of [
      ...((visibleRegistrationsResult.data ?? []) as RentalRegistration[]),
      ...((outstandingRegistrationsResult.data ?? []) as RentalRegistration[]),
    ]) {
      registrationMap.set(registration.id, registration);
    }
    const loadedRegistrations = Array.from(registrationMap.values());
    const visibleSlotIdSet = new Set(visibleSlotIds);
    const outstandingSlotIds = Array.from(
      new Set(
        loadedRegistrations
          .filter(
            (registration) =>
              !registration.is_paid &&
              !visibleSlotIdSet.has(registration.rental_slot_id)
          )
          .map((registration) => registration.rental_slot_id)
      )
    );

    const outstandingSlotsResult = outstandingSlotIds.length
      ? await supabase
          .from("rental_slots")
          .select(
            "id, rental_date, start_time, end_time, capacity, board_manager_id, min_surf_level, note, is_open, created_by, created_at, updated_at"
          )
          .in("id", outstandingSlotIds)
      : emptyResult;

    if (outstandingSlotsResult.error) {
      setIsLoadingRentals(false);
      setStatusMessage(
        `讀取未繳費時段失敗：${outstandingSlotsResult.error.message}`
      );
      return;
    }

    const loadedSlots = [
      ...visibleSlots,
      ...((outstandingSlotsResult.data ?? []) as RentalSlot[]),
    ];

    if (canManageSlots) {
      const staffResult = await supabase
        .from("profiles")
        .select("id, email, full_name, student_id, surf_level, role")
        .in("role", ["board_manager", "officer", "admin"])
        .order("role", { ascending: true })
        .order("full_name", { ascending: true });

      if (staffResult.error) {
        setIsLoadingRentals(false);
        setStatusMessage(`讀取負責人名單失敗：${staffResult.error.message}`);
        return;
      }

      setStaffProfiles((staffResult.data ?? []) as ResponsibleProfile[]);
    } else {
      setStaffProfiles([]);
    }

    setRentalSlots(loadedSlots);
    setRentalRegistrations(loadedRegistrations);
    setMemberProfiles((membersResult.data ?? []) as PublicMemberProfile[]);
    setSelectedSlotId((current) =>
      current && loadedSlots.some((slot) => slot.id === current)
        ? current
        : null
    );
    setIsLoadingRentals(false);
  }, [
    calendarCells,
    canManageSlots,
    canViewUnpaid,
    setStatusMessage,
    user,
  ]);

  const loadSurfboardData = useCallback(async () => {
    setIsLoadingSurfboards(true);
    setSurfboardLoadError("");

    const boardsResult = await fetchSurfboards();

    if (boardsResult.error !== null) {
      setIsLoadingSurfboards(false);
      setSurfboards([]);
      setSurfboardImageUrls({});
      setSurfboardLoadError(`讀取衝浪板失敗：${boardsResult.error}`);
      return;
    }

    const storagePaths = boardsResult.data.flatMap((board) =>
      board.images.map((image) => image.storage_path)
    );
    const urlsResult = await createSignedSurfboardImageUrls(storagePaths);

    setIsLoadingSurfboards(false);
    setSurfboards(boardsResult.data);

    if (urlsResult.error !== null) {
      setSurfboardImageUrls({});
      setSurfboardLoadError(`讀取衝浪板圖片失敗：${urlsResult.error}`);
      return;
    }

    setSurfboardImageUrls(urlsResult.urls);
  }, []);

  useEffect(() => {
    if (!canView) return;
    queueMicrotask(() => void loadRentalData());
  }, [canView, loadRentalData]);

  useEffect(() => {
    if (!canPickSurfboards) return;
    queueMicrotask(() => void loadSurfboardData());
  }, [canPickSurfboards, loadSurfboardData]);

  const isSlotFull = (slot: RentalSlot) => {
    return getSlotRegistrations(slot.id).length >= slot.capacity;
  };

  const moveMonth = (offset: number) => {
    setMonthCursor(
      (current) =>
        new Date(
          Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth() + offset,
            1
          )
        )
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

    if (!newSlotBoardManagerId.trim()) {
      setStatusMessage("請選擇負責人。");
      return;
    }

    // 以台灣時間驗證完整的日期＋開始時間，今天已經過去的時間也不能新增。
    if (
      !isRentalSlotStartInFuture({
        rental_date: newSlotDate,
        start_time: newSlotStartTime,
      })
    ) {
      setStatusMessage("租板開始時間必須晚於目前時間。");
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
      board_manager_id: newSlotBoardManagerId,
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

    setNewSlotDate(getTaipeiTodayDate());
    setNewSlotStartTime("15:00");
    setNewSlotEndTime("17:00");
    setNewSlotCapacity("5");
    setNewSlotBoardManagerId(user.id);
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

    if (isSlotExpired(slot)) {
      setStatusMessage("此租板時段已過期，無法重新開放或關閉。");
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

  /** 登記前先開啟挑板視窗，實際登記在 handleConfirmRegistration。 */
  const handleRegisterRental = async (slot: RentalSlot) => {
    if (!user) {
      setStatusMessage("請先登入後再登記租板。");
      return;
    }

    if (!canView) {
      setStatusMessage("目前身份尚未開通租板權限。");
      return;
    }

    if (isSlotExpired(slot)) {
      setStatusMessage("此租板時段已過期，無法登記");
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

    if (myUnpaidCount >= 2) {
      setStatusMessage(
        `您目前租板未繳費 ${myUnpaidCount}/2，請先完成補繳後再租板`
      );
      return;
    }

    setStatusMessage("");
    setPickerSlotId(slot.id);
  };

  const handleConfirmRegistration = async (surfboardId: string) => {
    if (!pickerSlotId) return;

    const slot = rentalSlots.find((item) => item.id === pickerSlotId);
    if (!slot) {
      setPickerSlotId(null);
      setStatusMessage("找不到租板時段，請重新整理後再試。");
      return;
    }

    if (isSlotExpired(slot)) {
      setPickerSlotId(null);
      setStatusMessage("此租板時段已過期，無法登記");
      return;
    }

    setSavingRegistrationSlotId(slot.id);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("register_rental_slot", {
      target_slot_id: slot.id,
      target_surfboard_id: surfboardId,
    });

    setSavingRegistrationSlotId(null);

    if (error) {
      setStatusMessage(`登記租板失敗：${error.message}`);
      await loadRentalData();
      return;
    }

    setPickerSlotId(null);
    setSelectedSlotId(slot.id);
    setStatusMessage(
      myUnpaidCount === 1
        ? "已登記租板。提醒：您目前租板未繳費 1/2。"
        : "已登記租板。"
    );
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

    const slot = rentalSlots.find(
      (item) => item.id === registration.rental_slot_id
    );
    if (slot && isSlotExpired(slot)) {
      setStatusMessage("租板時段已開始，無法取消");
      return;
    }

    setSavingRegistrationSlotId(registration.rental_slot_id);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_rental_registration", {
      target_registration_id: registration.id,
    });

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
    if (!canMarkPaid) {
      setStatusMessage("只有幹部與管理員可以更新繳費狀態。");
      return;
    }

    setUpdatingPaymentRegistrationId(registration.id);
    setStatusMessage("");

    const supabase = createClient();

    if (isPaid) {
      const { error } = await supabase.rpc("mark_rental_registration_paid", {
        target_registration_id: registration.id,
      });

      setUpdatingPaymentRegistrationId(null);

      if (error) {
        setStatusMessage(`更新繳費狀態失敗：${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase
        .from("rental_registrations")
        .update({
          is_paid: false,
          paid_at: null,
          paid_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registration.id);

      setUpdatingPaymentRegistrationId(null);

      if (error) {
        setStatusMessage(`更新繳費狀態失敗：${error.message}`);
        return;
      }
    }

    setStatusMessage("繳費狀態已更新。");
    await loadRentalData();
  };

  const handleMarkUnpaidAsPaid = async (registration: RentalRegistration) => {
    if (!canMarkPaid) {
      setStatusMessage("只有幹部與管理員可以標記補繳。");
      return;
    }

    if (
      !window.confirm("確認此筆租板費用已補繳？")
    ) {
      return;
    }

    setUpdatingPaymentRegistrationId(registration.id);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("mark_rental_registration_paid", {
      target_registration_id: registration.id,
    });

    setUpdatingPaymentRegistrationId(null);

    if (error) {
      setStatusMessage(`補繳標記失敗：${error.message}`);
      return;
    }

    setStatusMessage("已標記補繳。");
    await loadRentalData();
  };

  return (
    <main className="min-h-screen bg-bg text-slate-950">
      <Navbar
        user={user}
        profile={profile}
        isLoading={isLoading}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
              <CalendarDays size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-normal text-slate-900 sm:text-2xl">
                租板
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {canView
                  ? "社員以上可以查看與登記；板務、幹部與管理員可以新增、開關、刪除時段並管理繳費狀態。"
                  : "公開頁面提供租板日期、時間、開放狀態、最低程度與剩餘名額；登入並通過審核後即可登記。"}
              </p>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <Card className="flex items-center gap-2 text-sm text-slate-500">
            <RefreshCw size={16} className="animate-spin" />
            正在讀取登入狀態...
          </Card>
        ) : !user ? (
          <PublicRentalSchedule
            mode="guest"
            onRequireLogin={() => setIsLoginPromptOpen(true)}
          />
        ) : !canView ? (
          <PublicRentalSchedule
            mode="pending"
            onRequireLogin={() => setIsLoginPromptOpen(true)}
          />
        ) : (
          <>
            {canManageSlots && (
              <Card className="mb-6">
                <div className="mb-4 flex items-center gap-2">
                  <Plus size={18} className="text-primary" strokeWidth={2} />
                  <h2 className="font-semibold text-slate-900">新增租板時段</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="日期" hint="不能選擇今天以前的日期">
                    <input
                      type="date"
                      value={newSlotDate}
                      min={today}
                      onChange={(event) => setNewSlotDate(event.target.value)}
                      className={fieldControlClasses}
                    />
                  </FormField>

                  <FormField label="人數上限">
                    <input
                      type="number"
                      min="1"
                      value={newSlotCapacity}
                      onChange={(event) =>
                        setNewSlotCapacity(event.target.value)
                      }
                      className={fieldControlClasses}
                    />
                  </FormField>

                  <FormField label="開始時間">
                    <input
                      type="time"
                      value={newSlotStartTime}
                      onChange={(event) =>
                        setNewSlotStartTime(event.target.value)
                      }
                      className={fieldControlClasses}
                    />
                  </FormField>

                  <FormField label="結束時間">
                    <input
                      type="time"
                      value={newSlotEndTime}
                      onChange={(event) =>
                        setNewSlotEndTime(event.target.value)
                      }
                      className={fieldControlClasses}
                    />
                  </FormField>

                  <FormField label="負責人">
                    {staffProfiles.length === 0 ? (
                      <select
                        value=""
                        disabled
                        aria-label="負責人載入中"
                        className={fieldControlClasses}
                      >
                        <option value="">負責人名單載入中...</option>
                      </select>
                    ) : (
                      <select
                        value={newSlotBoardManagerId}
                        onChange={(event) =>
                          setNewSlotBoardManagerId(event.target.value)
                        }
                        className={fieldControlClasses}
                      >
                        {staffProfiles.map((staff) => {
                          const info = formatResponsiblePerson(staff, "未填姓名");
                          const label =
                            typeof info === "string"
                              ? info
                              : `${roleLabels[info.role]}（${info.name}）`;
                          return (
                            <option key={staff.id} value={staff.id}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </FormField>

                  <FormField label="最低衝浪程度">
                    <select
                      value={newSlotMinSurfLevel}
                      onChange={(event) =>
                        setNewSlotMinSurfLevel(event.target.value)
                      }
                      className={fieldControlClasses}
                    >
                      <option value="">不限制</option>
                      {surfLevelDescriptions.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.title}以上
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="備註" className="sm:col-span-2">
                    <textarea
                      value={newSlotNote}
                      onChange={(event) => setNewSlotNote(event.target.value)}
                      className={`min-h-24 ${fieldControlClasses}`}
                      placeholder="例如集合地點、浪況提醒或其他注意事項"
                    />
                  </FormField>
                </div>

                <Button
                  variant="primary"
                  fullWidth
                  className="mt-5 sm:w-auto"
                  icon={<Plus size={18} />}
                  onClick={() => void handleCreateRentalSlot()}
                  disabled={isCreatingRentalSlot}
                >
                  {isCreatingRentalSlot ? "新增中..." : "新增租板時段"}
                </Button>
              </Card>
            )}

            {canSeeSurfboards && <SurfboardManager />}

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
              <Card className="p-0 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                  <div>
                    <h2 className="font-semibold text-slate-900">租板日曆</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      點擊日期格中的時段查看詳細資料。
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="px-2.5"
                      aria-label="上個月"
                      onClick={() => moveMonth(-1)}
                    >
                      <ChevronLeft size={18} />
                    </Button>
                    <p className="min-w-24 text-center text-sm font-semibold text-slate-800">
                      {formatMonth(monthCursor)}
                    </p>
                    <Button
                      variant="outline"
                      className="px-2.5"
                      aria-label="下個月"
                      onClick={() => moveMonth(1)}
                    >
                      <ChevronRight size={18} />
                    </Button>
                    <Button
                      variant="outline"
                      className="px-2.5"
                      aria-label="重新整理"
                      onClick={() => void loadRentalData()}
                    >
                      <RefreshCw
                        size={18}
                        className={isLoadingRentals ? "animate-spin" : ""}
                      />
                    </Button>
                  </div>
                </div>

                {isLoadingRentals ? (
                  <p className="flex items-center gap-2 p-6 text-sm text-slate-500">
                    <RefreshCw size={16} className="animate-spin" />
                    正在讀取租板資料...
                  </p>
                ) : (
                  <div className="grid grid-cols-7">
                    {weekdayLabels.map((weekday) => (
                      <div
                        key={weekday}
                        className="border-b border-border bg-bg py-2 text-center text-xs font-semibold text-slate-500"
                      >
                        {weekday}
                      </div>
                    ))}

                    {calendarCells.map((cell) => {
                      const slotsForDay = rentalSlots.filter(
                        (slot) => slot.rental_date === cell.dateString
                      );
                      const isToday = cell.dateString === today;

                      return (
                        <div
                          key={cell.dateString}
                          className={`min-h-[84px] border-b border-r border-border p-1.5 last:border-r-0 sm:min-h-[104px] sm:p-2 ${
                            cell.isCurrentMonth ? "bg-surface" : "bg-bg"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (slotsForDay[0]) {
                                setSelectedSlotId(slotsForDay[0].id);
                              }
                            }}
                            className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                              isToday
                                ? "bg-primary text-white"
                                : cell.isCurrentMonth
                                  ? "text-slate-700"
                                  : "text-slate-300"
                            }`}
                          >
                            {cell.date.getDate()}
                          </button>

                          <div className="flex flex-col gap-1">
                            {slotsForDay.map((slot) => {
                              const registrations = getSlotRegistrations(slot.id);
                              const meetsLevel = userMeetsSurfLevel(
                                profile,
                                slot.min_surf_level
                              );
                              const full = isSlotFull(slot);
                              const expired = isSlotExpired(slot);
                              const isAvailableForUser =
                                !expired && slot.is_open && meetsLevel && !full;
                              const tone = getSurfLevelTone(slot.min_surf_level);
                              const isSelected = selectedSlotId === slot.id;

                              return (
                                <button
                                  type="button"
                                  key={slot.id}
                                  onClick={() => setSelectedSlotId(slot.id)}
                                  className={`w-full rounded-lg border px-1.5 py-1 text-left text-[11px] leading-tight transition-colors ${
                                    isSelected
                                      ? "border-primary bg-primary-light"
                                      : isAvailableForUser
                                        ? "border-border bg-surface hover:border-primary/50"
                                        : "border-border bg-bg text-slate-400"
                                  }`}
                                >
                                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                                    <span
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDotClasses[tone]}`}
                                    />
                                    <span className="truncate">
                                      {formatTime(slot.start_time)}
                                    </span>
                                  </span>
                                  <span className="mt-0.5 block text-slate-500">
                                    {registrations.length}/{slot.capacity}
                                  </span>
                                  {expired ? (
                                    <span className="mt-0.5 block text-slate-400">
                                      已過期
                                    </span>
                                  ) : (
                                    !slot.is_open && (
                                      <span className="mt-0.5 block text-slate-400">
                                        未開放
                                      </span>
                                    )
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
              </Card>

              <div className="grid gap-6">
                {selectedSlot ? (
                  <RentalSlotDetail
                    slot={selectedSlot}
                    profile={profile}
                    registrations={getSlotRegistrations(selectedSlot.id)}
                    boardManager={getResponsibleProfileById(
                      selectedSlot.board_manager_id
                    )}
                    getPublicProfileById={getPublicProfileById}
                    myRegistration={getMyRegistration(selectedSlot.id)}
                    isFull={isSlotFull(selectedSlot)}
                    isExpired={isSlotExpired(selectedSlot)}
                    myUnpaidCount={myUnpaidCount}
                    canManageSlots={canManageSlots}
                    canMarkPaid={canMarkPaid}
                    getSurfboardById={getSurfboardById}
                    surfboardImageUrls={surfboardImageUrls}
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
                  <Card className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bg text-slate-400">
                      <CalendarDays size={22} strokeWidth={1.75} />
                    </span>
                    <h2 className="font-semibold text-slate-900">時段詳細資料</h2>
                    <p className="max-w-xs text-sm leading-6 text-slate-500">
                      請從日曆選擇一個租板時段查看詳細資料。
                    </p>
                  </Card>
                )}

                {canViewUnpaid && (
                  <UnpaidRentalsTable
                    unpaidRegistrations={unpaidRegistrations}
                    rentalSlots={rentalSlots}
                    getPublicProfileById={getPublicProfileById}
                    getResponsibleProfileById={getResponsibleProfileById}
                    canMarkPaid={canMarkPaid}
                    updatingPaymentRegistrationId={
                      updatingPaymentRegistrationId
                    }
                    onMarkPaid={handleMarkUnpaidAsPaid}
                  />
                )}
              </div>
            </section>
          </>
        )}

        {statusMessage && (
          <Card className="mt-6 flex items-start gap-2 text-sm text-slate-600">
            <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <span>{statusMessage}</span>
          </Card>
        )}
      </div>

      {pickerSlotId && (
        <SurfboardPicker
          boards={surfboards}
          imageUrls={surfboardImageUrls}
          profile={profile}
          takenSurfboardIds={getTakenSurfboardIds(pickerSlotId)}
          isLoading={isLoadingSurfboards}
          isSubmitting={savingRegistrationSlotId === pickerSlotId}
          loadErrorMessage={surfboardLoadError}
          onClose={() => setPickerSlotId(null)}
          onConfirm={handleConfirmRegistration}
        />
      )}

      {isLoginPromptOpen && (
        <LoginPromptDialog
          description="登記租板需要社員身分。登入後會自動建立社員資料，經幹部審核後即可登記並挑選衝浪板。"
          onLogin={() => {
            setIsLoginPromptOpen(false);
            void handleGoogleLogin("/rentals");
          }}
          onClose={() => setIsLoginPromptOpen(false)}
        />
      )}
    </main>
  );
}

function RentalSlotDetail({
  slot,
  profile,
  registrations,
  boardManager,
  getPublicProfileById,
  myRegistration,
  isFull,
  isExpired,
  myUnpaidCount,
  canManageSlots,
  canMarkPaid,
  getSurfboardById,
  surfboardImageUrls,
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
  profile: { surf_level: string | null } | null;
  registrations: RentalRegistration[];
  boardManager: ResponsibleProfile | PublicMemberProfile | null;
  getPublicProfileById: (profileId: string | null) => PublicMemberProfile | null;
  myRegistration: RentalRegistration | null;
  isFull: boolean;
  isExpired: boolean;
  myUnpaidCount: number;
  canManageSlots: boolean;
  canMarkPaid: boolean;
  getSurfboardById: (surfboardId: string | null) => SurfboardWithImages | null;
  surfboardImageUrls: Record<string, string>;
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
  const blockedByUnpaid = myUnpaidCount >= 2;
  const canRegister =
    !isExpired &&
    slot.is_open &&
    !isFull &&
    !myRegistration &&
    meetsLevel &&
    !blockedByUnpaid;
  const registrationRows = Array.from(
    { length: Math.max(slot.capacity, registrations.length) },
    (_, index) => registrations[index] ?? null
  );

  const getRegistrationSurfboard = (registration: RentalRegistration) => {
    const board = getSurfboardById(registration.surfboard_id);
    if (!board) return null;

    const cover = board.images[0];
    return {
      board,
      imageUrl: cover ? (surfboardImageUrls[cover.storage_path] ?? null) : null,
    };
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">時段詳細資料</h2>
          <p className="mt-1 text-sm text-slate-500">{formatDate(slot.rental_date)}</p>
        </div>

        {canManageSlots && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              icon={<Power size={16} />}
              title={
                isExpired ? "此租板時段已過期，無法開關" : undefined
              }
              onClick={() => void onToggleSlot(slot)}
              disabled={isExpired || updatingRentalSlotId === slot.id}
            >
              {isExpired
                ? "已過期"
                : updatingRentalSlotId === slot.id
                  ? "更新中..."
                  : slot.is_open
                    ? "關閉"
                    : "開放"}
            </Button>

            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={() => void onDeleteSlot(slot.id)}
              disabled={deletingRentalSlotId === slot.id}
            >
              {deletingRentalSlotId === slot.id ? "刪除中..." : "刪除"}
            </Button>
          </div>
        )}
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <Clock size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">時間</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {formatTime(slot.start_time)}-{formatTime(slot.end_time)}
            </dd>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">開放狀態</dt>
            <dd className="mt-0.5">
              {/* 已過期優先於 is_open，過期時不會顯示「開放中」。 */}
              {isExpired ? (
                <Badge tone="neutral">已過期</Badge>
              ) : (
                <Badge tone={slot.is_open ? "success" : "neutral"}>
                  {slot.is_open ? "開放中" : "已關閉"}
                </Badge>
              )}
            </dd>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Users size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">負責人</dt>
            <dd className="mt-0.5">
              <ResponsiblePersonTag person={boardManager} />
            </dd>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Gauge size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">最低程度</dt>
            <dd className="mt-0.5">
              {slot.min_surf_level ? (
                <span className="inline-flex items-center gap-2">
                  <SurfLevelPill level={slot.min_surf_level} />
                  <span className="text-slate-500">以上</span>
                </span>
              ) : (
                <span className="text-slate-500">不限制</span>
              )}
            </dd>
          </div>
        </div>

        <div className="flex items-start gap-2 sm:col-span-2">
          <Users size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">名額</dt>
            <dd className="mt-0.5 flex items-center gap-2 font-medium text-slate-800">
              {registrations.length}/{slot.capacity}
              {isFull && <Badge tone="warning">已額滿</Badge>}
            </dd>
          </div>
        </div>
      </dl>

      {slot.note && (
        <p className="mt-5 whitespace-pre-wrap rounded-xl border border-border bg-bg p-3 text-sm leading-6 text-slate-600">
          備註：{slot.note}
        </p>
      )}

      <div className="mt-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
          <Users size={16} className="text-slate-400" />
          登記名單
        </h3>

        <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
          <table className="w-full min-w-[560px] border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-xs text-slate-500">
                <th className="px-3 py-2 text-center font-medium">編號</th>
                <th className="px-3 py-2 text-center font-medium">姓名</th>
                <th className="px-3 py-2 text-center font-medium">學號</th>
                <th className="px-3 py-2 text-center font-medium">衝浪程度</th>
                <th className="px-3 py-2 text-center font-medium">繳費</th>
                <th className="px-3 py-2 text-center font-medium">衝浪板</th>
              </tr>
            </thead>
            <tbody>
              {registrationRows.map((registration, index) => {
                const renter = registration
                  ? getPublicProfileById(registration.user_id)
                  : null;
                const surfboard = registration
                  ? getRegistrationSurfboard(registration)
                  : null;

                return (
                  <tr
                    key={registration?.id ?? `empty-${slot.id}-${index}`}
                    className="border-b border-border last:border-b-0"
                  >
                    <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">
                      {registration ? renter?.full_name || "未填姓名" : "空位"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {registration ? renter?.student_id || "未填學號" : "-"}
                    </td>
                    <td className="px-3 py-3">
                      {registration ? (
                        <SurfLevelPill level={renter?.surf_level ?? null} />
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {registration ? (
                        <span className="inline-flex justify-center">
                          <PaymentControl
                            registration={registration}
                            canMarkPaid={canMarkPaid}
                            updatingPaymentRegistrationId={
                              updatingPaymentRegistrationId
                            }
                            onTogglePayment={onTogglePayment}
                          />
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {surfboard ? (
                        <span className="flex flex-col items-center gap-1">
                          <SurfboardThumbnail
                            boardName={surfboard.board.name}
                            imageUrl={surfboard.imageUrl}
                          />
                          <span className="max-w-24 truncate text-xs text-slate-600">
                            {surfboard.board.name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 md:hidden">
          {registrationRows.map((registration, index) => {
            const renter = registration
              ? getPublicProfileById(registration.user_id)
              : null;
            const surfboard = registration
              ? getRegistrationSurfboard(registration)
              : null;

            return (
              <div
                key={registration?.id ?? `empty-mobile-${slot.id}-${index}`}
                className="rounded-xl border border-border bg-bg p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">編號 {index + 1}</p>
                    <p className="mt-0.5 truncate font-medium text-slate-800">
                      {registration ? renter?.full_name || "未填姓名" : "空位"}
                    </p>
                    {registration && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        學號：{renter?.student_id || "未填學號"}
                      </p>
                    )}
                  </div>
                  {registration && (
                    <span className="shrink-0">
                      <SurfLevelPill level={renter?.surf_level ?? null} />
                    </span>
                  )}
                </div>

                {registration && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <PaymentControl
                      registration={registration}
                      canMarkPaid={canMarkPaid}
                      updatingPaymentRegistrationId={
                        updatingPaymentRegistrationId
                      }
                      onTogglePayment={onTogglePayment}
                    />

                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-xs text-slate-500">
                        衝浪板
                      </span>
                      {surfboard ? (
                        <>
                          <SurfboardThumbnail
                            boardName={surfboard.board.name}
                            imageUrl={surfboard.imageUrl}
                            className="h-9 w-9"
                          />
                          <span className="min-w-0 truncate text-xs text-slate-600">
                            {surfboard.board.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        {myRegistration ? (
          isExpired ? (
            <div className="rounded-xl border border-warning/30 bg-warning-light px-3 py-2 text-sm text-slate-700">
              租板時段已開始，無法取消
            </div>
          ) : (
            <Button
              variant="danger"
              fullWidth
              className="sm:w-auto"
              icon={<X size={16} />}
              onClick={() => void onCancelRegistration(myRegistration)}
              disabled={savingRegistrationSlotId === slot.id}
            >
              {savingRegistrationSlotId === slot.id
                ? "取消中..."
                : "取消我的登記"}
            </Button>
          )
        ) : (
          <Button
            variant="primary"
            fullWidth
            className="sm:w-auto"
            onClick={() => void onRegister(slot)}
            disabled={!canRegister || savingRegistrationSlotId === slot.id}
          >
            {savingRegistrationSlotId === slot.id ? "登記中..." : "登記租板"}
          </Button>
        )}

        <div className="mt-3 flex flex-col gap-1.5">
          {isExpired && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Info size={13} />
              此租板時段已過期，無法登記
            </p>
          )}

          {!myRegistration && myUnpaidCount === 1 && (
            <p className="flex items-center gap-1.5 text-xs text-warning">
              <Info size={13} />
              您目前租板未繳費 1/2
            </p>
          )}

          {!myRegistration && myUnpaidCount >= 2 && (
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <Info size={13} />
              您目前租板未繳費 {myUnpaidCount}/2，請先完成補繳後再租板
            </p>
          )}

          {!isExpired && !slot.is_open && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Info size={13} />
              此時段目前未開放登記。
            </p>
          )}

          {!isExpired && slot.is_open && isFull && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Info size={13} />
              此時段已額滿。
            </p>
          )}

          {slot.is_open && !meetsLevel && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Info size={13} />
              你的衝浪程度尚未符合此時段最低要求。
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function UnpaidRentalsTable({
  unpaidRegistrations,
  rentalSlots,
  getPublicProfileById,
  getResponsibleProfileById,
  canMarkPaid,
  updatingPaymentRegistrationId,
  onMarkPaid,
}: {
  unpaidRegistrations: RentalRegistration[];
  rentalSlots: RentalSlot[];
  getPublicProfileById: (profileId: string | null) => PublicMemberProfile | null;
  getResponsibleProfileById: (
    profileId: string | null
  ) => ResponsibleProfile | PublicMemberProfile | null;
  canMarkPaid: boolean;
  updatingPaymentRegistrationId: string | null;
  onMarkPaid: (registration: RentalRegistration) => Promise<void>;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Wallet size={18} className="text-warning" />
        <h2 className="font-semibold text-slate-900">租板未繳費資訊</h2>
      </div>

      {unpaidRegistrations.length === 0 ? (
        <p className="text-sm text-slate-500">目前沒有未繳費紀錄</p>
      ) : (
        <>
          <div className="hidden max-h-80 overflow-auto rounded-xl border border-border md:block">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-xs text-slate-500">
                  <th className="px-3 py-2 font-medium">未付款的人</th>
                  <th className="px-3 py-2 font-medium">負責板務</th>
                  <th className="px-3 py-2 font-medium">日期</th>
                  <th className="px-3 py-2 font-medium">補繳</th>
                </tr>
              </thead>
              <tbody>
                {unpaidRegistrations.map((registration) => {
                  const slot = rentalSlots.find(
                    (item) => item.id === registration.rental_slot_id
                  );
                  const renter = getPublicProfileById(registration.user_id);
                  const boardManager = getResponsibleProfileById(
                    slot?.board_manager_id ?? null
                  );
                  const managerInfo = formatResponsiblePerson(
                    boardManager,
                    "未指定"
                  );

                  return (
                    <tr
                      key={registration.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-800">
                          {renter?.full_name || "未填姓名"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {renter?.student_id || "未填學號"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {typeof managerInfo === "string"
                          ? managerInfo
                          : managerInfo.name}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {slot ? (
                          <>
                            <p>{formatShortDate(slot.rental_date)}</p>
                            <p className="text-xs text-slate-500">
                              {formatTime(slot.start_time)}–
                              {formatTime(slot.end_time)}
                            </p>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {canMarkPaid ? (
                          <input
                            type="checkbox"
                            checked={false}
                            disabled={
                              updatingPaymentRegistrationId === registration.id
                            }
                            onChange={() => void onMarkPaid(registration)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
                            aria-label="標記補繳"
                          />
                        ) : (
                          <span className="text-xs text-warning">未繳費</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid max-h-80 gap-3 overflow-y-auto md:hidden">
            {unpaidRegistrations.map((registration) => {
              const slot = rentalSlots.find(
                (item) => item.id === registration.rental_slot_id
              );
              const renter = getPublicProfileById(registration.user_id);
              const boardManager = getResponsibleProfileById(
                slot?.board_manager_id ?? null
              );
              const managerInfo = formatResponsiblePerson(
                boardManager,
                "未指定"
              );

              return (
                <div
                  key={registration.id}
                  className="rounded-xl border border-border bg-bg p-3"
                >
                  <p className="font-medium text-slate-800">
                    {renter?.full_name || "未填姓名"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    學號：{renter?.student_id || "未填學號"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    負責板務：
                    {typeof managerInfo === "string"
                      ? managerInfo
                      : managerInfo.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    日期：
                    {slot
                      ? `${formatShortDate(slot.rental_date)} ${formatTime(slot.start_time)}–${formatTime(slot.end_time)}`
                      : "-"}
                  </p>
                  <div className="mt-3 border-t border-border pt-3">
                    {canMarkPaid ? (
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={false}
                          disabled={
                            updatingPaymentRegistrationId === registration.id
                          }
                          onChange={() => void onMarkPaid(registration)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                        />
                        補繳
                      </label>
                    ) : (
                      <span className="text-xs text-warning">未繳費</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function PaymentControl({
  registration,
  canMarkPaid,
  updatingPaymentRegistrationId,
  onTogglePayment,
}: {
  registration: RentalRegistration;
  canMarkPaid: boolean;
  updatingPaymentRegistrationId: string | null;
  onTogglePayment: (
    registration: RentalRegistration,
    isPaid: boolean
  ) => Promise<void>;
}) {
  return (
    <label className="inline-flex min-h-11 items-center gap-2">
      <input
        type="checkbox"
        checked={registration.is_paid}
        disabled={
          !canMarkPaid || updatingPaymentRegistrationId === registration.id
        }
        onChange={(event) =>
          void onTogglePayment(registration, event.target.checked)
        }
        className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary disabled:cursor-not-allowed"
      />
      <Badge tone={registration.is_paid ? "success" : "warning"}>
        <Wallet size={12} />
        {registration.is_paid ? "已繳" : "未繳"}
      </Badge>
    </label>
  );
}
