"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Role = "pending" | "member" | "board_manager" | "officer" | "admin";

type SurfLevel = "初階" | "中階" | "中進階" | "進階";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  student_id: string | null;
  surf_level: string | null;
  role: Role;
  created_at?: string;
};

type PublicMemberProfile = {
  id: string;
  full_name: string | null;
  surf_level: string | null;
  role: Role;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type RentalSlot = {
  id: string;
  rental_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  board_manager_id: string | null;
  min_surf_level: string | null;
  note: string | null;
  is_open: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type RentalRegistration = {
  id: string;
  rental_slot_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

const roleLabels: Record<Role, string> = {
  pending: "待審核",
  member: "社員",
  board_manager: "板務",
  officer: "幹部",
  admin: "管理員",
};

const roleOptions: Role[] = [
  "pending",
  "member",
  "board_manager",
  "officer",
  "admin",
];

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

const surfLevelRanks: Record<SurfLevel, number> = {
  初階: 1,
  中階: 2,
  中進階: 3,
  進階: 4,
};

const surfLevelColorClasses: Record<SurfLevel, string> = {
  初階: "bg-blue-500",
  中階: "bg-green-500",
  中進階: "bg-yellow-400",
  進階: "bg-red-500",
};

function getTodayDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function getSurfLevelRank(level: string | null) {
  if (!level) return 0;
  return surfLevelRanks[level as SurfLevel] ?? 0;
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

function SurfLevelBadge({ level }: { level: string | null }) {
  if (!level) {
    return <span className="text-slate-500">未填</span>;
  }

  const colorClass =
    surfLevelColorClasses[level as SurfLevel] ?? "bg-slate-300";

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded-sm ${colorClass}`} />
      <span>{level}</span>
    </span>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<PublicMemberProfile[]>(
    []
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [rentalSlots, setRentalSlots] = useState<RentalSlot[]>([]);
  const [rentalRegistrations, setRentalRegistrations] = useState<
    RentalRegistration[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
  const [isLoadingRentals, setIsLoadingRentals] = useState(false);
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [isCreatingRentalSlot, setIsCreatingRentalSlot] = useState(false);

  const [savingRoleUserId, setSavingRoleUserId] = useState<string | null>(null);
  const [deletingAnnouncementId, setDeletingAnnouncementId] =
    useState<string | null>(null);
  const [updatingAnnouncementId, setUpdatingAnnouncementId] =
    useState<string | null>(null);
  const [deletingRentalSlotId, setDeletingRentalSlotId] =
    useState<string | null>(null);
  const [updatingRentalSlotId, setUpdatingRentalSlotId] =
    useState<string | null>(null);
  const [savingRegistrationSlotId, setSavingRegistrationSlotId] =
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

  const [newSlotDate, setNewSlotDate] = useState(getTodayDate());
  const [newSlotStartTime, setNewSlotStartTime] = useState("15:00");
  const [newSlotEndTime, setNewSlotEndTime] = useState("17:00");
  const [newSlotCapacity, setNewSlotCapacity] = useState("5");
  const [newSlotBoardManagerId, setNewSlotBoardManagerId] = useState("");
  const [newSlotMinSurfLevel, setNewSlotMinSurfLevel] = useState("");
  const [newSlotNote, setNewSlotNote] = useState("");

  const canViewAnnouncements =
    profile?.role === "member" ||
    profile?.role === "board_manager" ||
    profile?.role === "officer" ||
    profile?.role === "admin";

  const canManageAnnouncements =
    profile?.role === "officer" || profile?.role === "admin";

  const canViewRentals =
    profile?.role === "member" ||
    profile?.role === "board_manager" ||
    profile?.role === "officer" ||
    profile?.role === "admin";

  const canManageRentalSlots =
    profile?.role === "board_manager" ||
    profile?.role === "officer" ||
    profile?.role === "admin";

  const canManageMemberRoles =
    profile?.role === "officer" || profile?.role === "admin";

  const staffProfiles = allProfiles.filter((member) =>
    ["board_manager", "officer", "admin"].includes(member.role)
  );

  const slotDates = Array.from(
    new Set(rentalSlots.map((slot) => slot.rental_date))
  ).sort();

  const syncProfileForm = (profileData: Profile) => {
    setFullName(profileData.full_name ?? "");
    setStudentId(profileData.student_id ?? "");
    setSurfLevel(profileData.surf_level ?? "");
  };

  const getPublicProfileById = (profileId: string | null) => {
    if (!profileId) return null;
    return memberProfiles.find((member) => member.id === profileId) ?? null;
  };

  const getSlotRegistrations = (slotId: string) => {
    return rentalRegistrations.filter(
      (registration) => registration.rental_slot_id === slotId
    );
  };

  const getMyRegistration = (slotId: string) => {
    if (!user) return null;

    return (
      rentalRegistrations.find(
        (registration) =>
          registration.rental_slot_id === slotId &&
          registration.user_id === user.id
      ) ?? null
    );
  };

  const userMeetsSlotLevel = (slot: RentalSlot) => {
    if (!slot.min_surf_level) return true;

    return (
      getSurfLevelRank(profile?.surf_level ?? null) >=
      getSurfLevelRank(slot.min_surf_level)
    );
  };

  const isSlotFull = (slot: RentalSlot) => {
    return getSlotRegistrations(slot.id).length >= slot.capacity;
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

  const loadMemberProfiles = async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("public_member_profiles")
      .select("id, full_name, surf_level, role");

    if (error) {
      setStatusMessage(`讀取社員公開資料失敗：${error.message}`);
      return;
    }

    setMemberProfiles((data ?? []) as PublicMemberProfile[]);
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

  const loadRentalData = async () => {
    setIsLoadingRentals(true);

    const supabase = createClient();

    const [slotsResult, registrationsResult] = await Promise.all([
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
    ]);

    setIsLoadingRentals(false);

    if (slotsResult.error) {
      setStatusMessage(`讀取租板時段失敗：${slotsResult.error.message}`);
      return;
    }

    if (registrationsResult.error) {
      setStatusMessage(
        `讀取租板登記失敗：${registrationsResult.error.message}`
      );
      return;
    }

    setRentalSlots((slotsResult.data ?? []) as RentalSlot[]);
    setRentalRegistrations(
      (registrationsResult.data ?? []) as RentalRegistration[]
    );

    await loadMemberProfiles();
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

      if (["member", "board_manager", "officer", "admin"].includes(typedProfile.role)) {
        await loadAnnouncements();
        await loadRentalData();
      }

      if (["board_manager", "officer", "admin"].includes(typedProfile.role)) {
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
        setMemberProfiles([]);
        setAnnouncements([]);
        setRentalSlots([]);
        setRentalRegistrations([]);
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
    setMemberProfiles([]);
    setAnnouncements([]);
    setRentalSlots([]);
    setRentalRegistrations([]);
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

    if (["member", "board_manager", "officer", "admin"].includes(typedProfile.role)) {
      await loadAnnouncements();
      await loadRentalData();
    }

    if (["board_manager", "officer", "admin"].includes(typedProfile.role)) {
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

  const handleCreateRentalSlot = async () => {
    if (!user || !profile) {
      setStatusMessage("尚未登入，無法新增租板時段");
      return;
    }

    if (!canManageRentalSlots) {
      setStatusMessage("只有板務、幹部或管理員可以新增租板時段");
      return;
    }

    if (!newSlotDate) {
      setStatusMessage("請選擇租板日期");
      return;
    }

    if (!newSlotStartTime || !newSlotEndTime) {
      setStatusMessage("請填寫開始與結束時間");
      return;
    }

    if (newSlotStartTime >= newSlotEndTime) {
      setStatusMessage("結束時間必須晚於開始時間");
      return;
    }

    const capacityNumber = Number(newSlotCapacity);

    if (!Number.isInteger(capacityNumber) || capacityNumber < 1) {
      setStatusMessage("名額必須是大於 0 的整數");
      return;
    }

    setIsCreatingRentalSlot(true);
    setStatusMessage("");

    const supabase = createClient();

    const { error } = await supabase.from("rental_slots").insert({
      rental_date: newSlotDate,
      start_time: newSlotStartTime,
      end_time: newSlotEndTime,
      capacity: capacityNumber,
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
    setStatusMessage("租板時段已新增");
    await loadRentalData();
  };

  const handleToggleRentalSlot = async (slot: RentalSlot) => {
    if (!canManageRentalSlots) {
      setStatusMessage("只有板務、幹部或管理員可以管理租板時段");
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

    setStatusMessage(slot.is_open ? "租板時段已關閉" : "租板時段已開放");
    await loadRentalData();
  };

  const handleDeleteRentalSlot = async (slotId: string) => {
    if (!canManageRentalSlots) {
      setStatusMessage("只有板務、幹部或管理員可以刪除租板時段");
      return;
    }

    const confirmed = window.confirm(
      "確定要刪除這個租板時段嗎？相關登記也會一起刪除。"
    );

    if (!confirmed) {
      return;
    }

    setDeletingRentalSlotId(slotId);
    setStatusMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("rental_slots")
      .delete()
      .eq("id", slotId);

    setDeletingRentalSlotId(null);

    if (error) {
      setStatusMessage(`刪除租板時段失敗：${error.message}`);
      return;
    }

    setStatusMessage("租板時段已刪除");
    await loadRentalData();
  };

  const handleRegisterRental = async (slot: RentalSlot) => {
    if (!user || !profile) {
      setStatusMessage("尚未登入，無法登記租板");
      return;
    }

    if (!canViewRentals) {
      setStatusMessage("你目前不是正式社員，無法登記租板");
      return;
    }

    if (!profile.full_name || !profile.student_id || !profile.surf_level) {
      setStatusMessage("請先完整填寫姓名、學號與衝浪程度，再登記租板");
      return;
    }

    if (!slot.is_open) {
      setStatusMessage("這個時段目前未開放租板");
      return;
    }

    if (getMyRegistration(slot.id)) {
      setStatusMessage("你已經登記過這個時段");
      return;
    }

    if (isSlotFull(slot)) {
      setStatusMessage("這個時段名額已滿");
      return;
    }

    if (!userMeetsSlotLevel(slot)) {
      setStatusMessage(
        `這個時段限制 ${slot.min_surf_level} 以上程度才能登記`
      );
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

    setStatusMessage("租板登記成功");
    await loadRentalData();
  };

  const handleCancelRentalRegistration = async (
    registration: RentalRegistration
  ) => {
    if (!user) {
      setStatusMessage("尚未登入，無法取消登記");
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

    setStatusMessage("已取消租板登記");
    await loadRentalData();
  };

  const handleUpdateRole = async (targetProfile: Profile, newRole: Role) => {
    if (!user || !canManageMemberRoles) {
      setStatusMessage("你不是幹部或管理員，無法修改社員身分");
      return;
    }

    if (targetProfile.id === user.id) {
      setStatusMessage("不能在這裡修改自己的系統身分，避免鎖死後台權限");
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
    await loadMemberProfiles();
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-8 shadow-sm">
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
                    <div className="flex items-center gap-2">
                      <SurfLevelBadge level={level.value} />
                    </div>
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
                  社員、板務、幹部與管理員可以查看公告。
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

        {profile && canViewRentals && (
          <div className="mb-8 rounded-xl border border-slate-200 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">租板時段</h2>
                <p className="mt-1 text-sm text-slate-600">
                  原則上租板時間為週一到週五 15:00–17:00，每個時段預設 5 個名額。
                </p>
              </div>

              <button
                onClick={loadRentalData}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                重新整理
              </button>
            </div>

            {canManageRentalSlots && (
              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-3 font-medium">新增租板時段</h3>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-sm font-medium">日期</span>
                    <input
                      type="date"
                      value={newSlotDate}
                      onChange={(event) => setNewSlotDate(event.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">名額</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={newSlotCapacity}
                      onChange={(event) =>
                        setNewSlotCapacity(event.target.value)
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2"
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
                      className="rounded-xl border border-slate-300 px-3 py-2"
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
                      className="rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">板務</span>
                    <select
                      value={newSlotBoardManagerId}
                      onChange={(event) =>
                        setNewSlotBoardManagerId(event.target.value)
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2"
                    >
                      <option value="">未指定板務</option>
                      {staffProfiles.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name || staff.email}（{roleLabels[staff.role]}）
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">最低程度限制</span>
                    <select
                      value={newSlotMinSurfLevel}
                      onChange={(event) =>
                        setNewSlotMinSurfLevel(event.target.value)
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2"
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
                      className="min-h-20 rounded-xl border border-slate-300 px-3 py-2"
                      placeholder="例如：請準時到艇庫集合"
                    />
                  </label>
                </div>

                <button
                  onClick={handleCreateRentalSlot}
                  disabled={isCreatingRentalSlot}
                  className="mt-4 w-fit rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isCreatingRentalSlot ? "新增中..." : "新增租板時段"}
                </button>
              </div>
            )}

            {isLoadingRentals ? (
              <p className="text-sm text-slate-600">讀取租板時段中...</p>
            ) : rentalSlots.length === 0 ? (
              <p className="text-sm text-slate-600">目前沒有租板時段。</p>
            ) : (
              <div className="grid gap-6">
                {slotDates.map((date) => (
                  <section key={date} className="rounded-xl border border-slate-200 p-4">
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
                          const meetsLevel = userMeetsSlotLevel(slot);
                          const canRegister =
                            slot.is_open &&
                            !full &&
                            !myRegistration &&
                            meetsLevel;

                          return (
                            <article
                              key={slot.id}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-semibold">
                                      {formatTime(slot.start_time)}–
                                      {formatTime(slot.end_time)}
                                    </h4>

                                    <span
                                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                                        slot.is_open
                                          ? "bg-green-100 text-green-700"
                                          : "bg-slate-200 text-slate-600"
                                      }`}
                                    >
                                      {slot.is_open ? "開放中" : "已關閉"}
                                    </span>
                                  </div>

                                  <p className="mt-2 text-sm text-slate-600">
                                    板務：
                                    {boardManager?.full_name || "未指定板務"}
                                  </p>

                                  <p className="mt-1 text-sm text-slate-600">
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

                                  <p className="mt-1 text-sm text-slate-600">
                                    名額：{registrations.length} / {slot.capacity}
                                  </p>

                                  {slot.note && (
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                      備註：{slot.note}
                                    </p>
                                  )}
                                </div>

                                {canManageRentalSlots && (
                                  <div className="flex shrink-0 flex-wrap gap-2">
                                    <button
                                      onClick={() => handleToggleRentalSlot(slot)}
                                      disabled={updatingRentalSlotId === slot.id}
                                      className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-white disabled:cursor-not-allowed disabled:text-slate-400"
                                    >
                                      {updatingRentalSlotId === slot.id
                                        ? "更新中..."
                                        : slot.is_open
                                          ? "關閉"
                                          : "開放"}
                                    </button>

                                    <button
                                      onClick={() =>
                                        handleDeleteRentalSlot(slot.id)
                                      }
                                      disabled={deletingRentalSlotId === slot.id}
                                      className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                    >
                                      {deletingRentalSlotId === slot.id
                                        ? "刪除中..."
                                        : "刪除"}
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                                <h5 className="mb-2 text-sm font-medium">
                                  已登記名單
                                </h5>

                                <div className="grid gap-2">
                                  {registrations.map((registration) => {
                                    const renter = getPublicProfileById(
                                      registration.user_id
                                    );

                                    return (
                                      <div
                                        key={registration.id}
                                        className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                                      >
                                        <div>
                                          <span className="font-medium">
                                            {renter?.full_name || "未填姓名"}
                                          </span>
                                          <span className="ml-3">
                                            <SurfLevelBadge
                                              level={renter?.surf_level ?? null}
                                            />
                                          </span>
                                        </div>

                                        {(registration.user_id === user?.id ||
                                          canManageRentalSlots) && (
                                          <button
                                            onClick={() =>
                                              handleCancelRentalRegistration(
                                                registration
                                              )
                                            }
                                            disabled={
                                              savingRegistrationSlotId === slot.id
                                            }
                                            className="text-sm text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400"
                                          >
                                            取消
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {Array.from({
                                    length: Math.max(
                                      slot.capacity - registrations.length,
                                      0
                                    ),
                                  }).map((_, index) => (
                                    <div
                                      key={`empty-${slot.id}-${index}`}
                                      className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400"
                                    >
                                      空位
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-4">
                                {myRegistration ? (
                                  <button
                                    onClick={() =>
                                      handleCancelRentalRegistration(
                                        myRegistration
                                      )
                                    }
                                    disabled={
                                      savingRegistrationSlotId === slot.id
                                    }
                                    className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                  >
                                    {savingRegistrationSlotId === slot.id
                                      ? "取消中..."
                                      : "取消我的登記"}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleRegisterRental(slot)}
                                    disabled={
                                      !canRegister ||
                                      savingRegistrationSlotId === slot.id
                                    }
                                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                  >
                                    {savingRegistrationSlotId === slot.id
                                      ? "登記中..."
                                      : "我要登記"}
                                  </button>
                                )}

                                {!slot.is_open && (
                                  <p className="mt-2 text-xs text-slate-500">
                                    此時段目前未開放。
                                  </p>
                                )}

                                {slot.is_open && full && (
                                  <p className="mt-2 text-xs text-slate-500">
                                    此時段名額已滿。
                                  </p>
                                )}

                                {slot.is_open && !meetsLevel && (
                                  <p className="mt-2 text-xs text-slate-500">
                                    你的程度未達此時段限制。
                                  </p>
                                )}
                              </div>
                            </article>
                          );
                        })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {profile && canManageMemberRoles && (
          <div className="mb-8 rounded-xl border border-slate-200 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">社員身分管理</h2>
                <p className="mt-1 text-sm text-slate-600">
                  幹部與管理員可以管理社員系統身分。
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
                          <SurfLevelBadge level={member.surf_level} />
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
              你不能在這裡修改自己的系統身分，避免把唯一管理權限改掉。
            </p>
          </div>
        )}

        {statusMessage && (
          <p className="mb-8 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            {statusMessage}
          </p>
        )}
      </div>
    </main>
  );
}