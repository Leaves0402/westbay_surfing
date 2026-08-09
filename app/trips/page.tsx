"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarRange,
  Info,
  Lock,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SpotMultiSelect, formatSpotLabel } from "@/components/trips/SpotMultiSelect";
import { TripChatModal } from "@/components/trips/TripChatModal";
import {
  TripConvoy,
  type TripCarWithPassengers,
} from "@/components/trips/TripConvoy";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { getRoleTone } from "@/lib/badgeTones";
import {
  canCreateSurfTrips,
  canViewSurfTrips,
  userMeetsSurfLevel,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { getTaipeiDate } from "@/lib/taipeiTime";
import {
  roleLabels,
  surfLevelOptions,
  type PublicMemberProfile,
  type SurfSpot,
  type SurfTrip,
  type SurfTripCar,
  type SurfTripCarPassenger,
  type SurfTripSpot,
  type SurfTripWaitlistEntry,
} from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

type TripWithDetails = SurfTrip & {
  spots: SurfSpot[];
  cars: TripCarWithPassengers[];
  waitlist: SurfTripWaitlistEntry[];
};

function parseLocalDate(dateString: string) {
  return new Date(`${dateString}T00:00:00+08:00`);
}

function formatDate(dateString: string) {
  return parseLocalDate(dateString).toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function formatMinSurfLevel(level: string | null | undefined) {
  if (!level) return "不限制";
  return `${level}以上`;
}

export default function TripsPage() {
  const {
    user,
    profile,
    isLoading,
    statusMessage,
    setStatusMessage,
    handleGoogleLogin,
    handleLogout,
  } = useAuthProfile();

  const [spots, setSpots] = useState<SurfSpot[]>([]);
  const [trips, setTrips] = useState<TripWithDetails[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<PublicMemberProfile[]>(
    []
  );
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [joiningKey, setJoiningKey] = useState<string | null>(null);
  const [leavingPassengerId, setLeavingPassengerId] = useState<string | null>(
    null
  );
  const [addingCarTripId, setAddingCarTripId] = useState<string | null>(null);
  const [newCarCapacity, setNewCarCapacity] = useState("3");
  const [isAddingCar, setIsAddingCar] = useState(false);
  const [removingSlotKey, setRemovingSlotKey] = useState<string | null>(null);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);
  const [editingLevelTripId, setEditingLevelTripId] = useState<string | null>(
    null
  );
  const [editingMinSurfLevel, setEditingMinSurfLevel] = useState("");
  const [isSavingLevel, setIsSavingLevel] = useState(false);
  const [chatTripId, setChatTripId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(() => getTaipeiDate(1));
  const [endDate, setEndDate] = useState(() => getTaipeiDate(1));
  const [selectedSpotIds, setSelectedSpotIds] = useState<string[]>([]);
  const [capacity, setCapacity] = useState("5");
  const [minSurfLevel, setMinSurfLevel] = useState("");
  const [note, setNote] = useState("");

  const canView = canViewSurfTrips(profile);
  const canCreate = canCreateSurfTrips(profile);

  const getMemberName = useCallback(
    (memberId: string) => {
      const member = memberProfiles.find((item) => item.id === memberId);
      if (member?.full_name) return member.full_name;
      if (memberId === user?.id) {
        return profile?.full_name || user?.email || "未填姓名";
      }
      return "未填姓名";
    },
    [memberProfiles, profile?.full_name, user?.email, user?.id]
  );

  const resetForm = useCallback(() => {
    const tomorrow = getTaipeiDate(1);
    setStartDate(tomorrow);
    setEndDate(tomorrow);
    setSelectedSpotIds([]);
    setCapacity("5");
    setMinSurfLevel("");
    setNote("");
  }, []);

  const loadTripData = useCallback(async () => {
    setIsLoadingTrips(true);
    setStatusMessage("");

    const supabase = createClient();
    const retentionStartDate = getTaipeiDate(-3);

    const { error: lifecycleError } = await supabase.rpc(
      "process_surf_trip_lifecycle"
    );
    if (lifecycleError) {
      setIsLoadingTrips(false);
      setStatusMessage(`更新外衝狀態失敗：${lifecycleError.message}`);
      return;
    }

    const [
      spotsResult,
      tripsResult,
      tripSpotsResult,
      carsResult,
      passengersResult,
      waitlistResult,
      membersResult,
    ] = await Promise.all([
      supabase
        .from("surf_spots")
        .select("id, name, county, sort_order, created_by, created_at")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("surf_trips")
        .select(
          "id, start_date, end_date, capacity, leader_id, min_surf_level, note, created_by, created_at, updated_at, participation_counted_at"
        )
        .gte("end_date", retentionStartDate)
        .order("start_date", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase.from("surf_trip_spots").select("trip_id, spot_id"),
      supabase
        .from("surf_trip_cars")
        .select("id, trip_id, leader_id, capacity, created_by, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("surf_trip_car_passengers")
        .select("id, car_id, trip_id, user_id, slot_index, created_at")
        .order("slot_index", { ascending: true }),
      supabase
        .from("surf_trip_waitlist")
        .select("id, trip_id, user_id, waitlist_order, created_at")
        .order("waitlist_order", { ascending: true }),
      supabase
        .from("public_member_profiles")
        .select("id, full_name, student_id, surf_level, role"),
    ]);

    setIsLoadingTrips(false);

    if (spotsResult.error) {
      setStatusMessage(`讀取浪點失敗：${spotsResult.error.message}`);
      return;
    }

    if (tripsResult.error) {
      setStatusMessage(`讀取外衝活動失敗：${tripsResult.error.message}`);
      return;
    }

    if (tripSpotsResult.error) {
      setStatusMessage(`讀取外衝地點失敗：${tripSpotsResult.error.message}`);
      return;
    }

    if (carsResult.error) {
      setStatusMessage(`讀取車隊失敗：${carsResult.error.message}`);
      return;
    }

    if (passengersResult.error) {
      setStatusMessage(`讀取跟車名單失敗：${passengersResult.error.message}`);
      return;
    }

    if (waitlistResult.error) {
      setStatusMessage(`讀取備取名單失敗：${waitlistResult.error.message}`);
      return;
    }

    if (membersResult.error) {
      setStatusMessage(`讀取社員公開資料失敗：${membersResult.error.message}`);
      return;
    }

    const loadedSpots = (spotsResult.data ?? []) as SurfSpot[];
    const loadedTrips = (tripsResult.data ?? []) as SurfTrip[];
    const loadedTripSpots = (tripSpotsResult.data ?? []) as SurfTripSpot[];
    const loadedCars = (carsResult.data ?? []) as SurfTripCar[];
    const loadedPassengers = (passengersResult.data ??
      []) as SurfTripCarPassenger[];
    const loadedWaitlist = (waitlistResult.data ??
      []) as SurfTripWaitlistEntry[];
    const spotsById = new Map(loadedSpots.map((spot) => [spot.id, spot]));

    const tripsWithDetails: TripWithDetails[] = loadedTrips.map((trip) => {
      const tripCars = loadedCars
        .filter((car) => car.trip_id === trip.id)
        .map((car) => ({
          ...car,
          passengers: loadedPassengers.filter(
            (passenger) => passenger.car_id === car.id
          ),
        }));

      return {
        ...trip,
        spots: loadedTripSpots
          .filter((item) => item.trip_id === trip.id)
          .map((item) => spotsById.get(item.spot_id))
          .filter((spot): spot is SurfSpot => Boolean(spot))
          .sort(
            (a, b) =>
              a.sort_order - b.sort_order ||
              a.name.localeCompare(b.name, "zh-Hant")
          ),
        cars: tripCars,
        waitlist: loadedWaitlist
          .filter((item) => item.trip_id === trip.id)
          .sort((a, b) => a.waitlist_order - b.waitlist_order),
      };
    });

    setSpots(loadedSpots);
    setTrips(tripsWithDetails);
    setMemberProfiles((membersResult.data ?? []) as PublicMemberProfile[]);
  }, [setStatusMessage]);

  useEffect(() => {
    if (!canView) return;
    queueMicrotask(() => void loadTripData());
  }, [canView, loadTripData]);

  const handleCreateSpot = async ({
    name,
    county,
  }: {
    name: string;
    county: string;
  }) => {
    if (!user || !canCreate) {
      setStatusMessage("只有正式成員可以新增浪點。");
      return null;
    }

    const existing = spots.find(
      (spot) => spot.name === name && spot.county === county
    );
    if (existing) {
      setStatusMessage("此浪點已存在，已直接選取。");
      return existing;
    }

    const supabase = createClient();
    const maxSortOrder = spots.reduce(
      (max, spot) => Math.max(max, spot.sort_order),
      0
    );

    const { data, error } = await supabase
      .from("surf_spots")
      .insert({
        name,
        county,
        sort_order: maxSortOrder + 1,
        created_by: user.id,
      })
      .select("id, name, county, sort_order, created_by, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: conflictSpot, error: conflictError } = await supabase
          .from("surf_spots")
          .select("id, name, county, sort_order, created_by, created_at")
          .eq("name", name)
          .eq("county", county)
          .maybeSingle();

        if (conflictError || !conflictSpot) {
          setStatusMessage(`新增浪點失敗：${error.message}`);
          return null;
        }

        setSpots((current) => {
          if (current.some((spot) => spot.id === conflictSpot.id)) {
            return current;
          }
          return [...current, conflictSpot as SurfSpot].sort(
            (a, b) =>
              a.sort_order - b.sort_order ||
              a.name.localeCompare(b.name, "zh-Hant")
          );
        });
        setStatusMessage("此浪點已存在，已直接選取。");
        return conflictSpot as SurfSpot;
      }

      setStatusMessage(`新增浪點失敗：${error.message}`);
      return null;
    }

    const createdSpot = data as SurfSpot;
    setSpots((current) =>
      [...current, createdSpot].sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.name.localeCompare(b.name, "zh-Hant")
      )
    );
    setStatusMessage("浪點已新增。");
    return createdSpot;
  };

  const handleCreateTrip = async () => {
    if (!user) {
      setStatusMessage("請先登入後再新增外衝。");
      return;
    }

    if (!canCreate) {
      setStatusMessage("只有正式成員可以新增外衝。");
      return;
    }

    if (!startDate || !endDate) {
      setStatusMessage("請選擇出發與回程日期。");
      return;
    }

    if (endDate < startDate) {
      setStatusMessage("回程日期不可早於出發日期。");
      return;
    }

    if (startDate <= getTaipeiDate()) {
      setStatusMessage("外衝必須至少提前一天建立，才能在開始時正確計次。");
      return;
    }

    if (selectedSpotIds.length === 0) {
      setStatusMessage("請至少選擇一個地點。");
      return;
    }

    const capacityValue = Number(capacity);
    if (!Number.isInteger(capacityValue) || capacityValue < 1) {
      setStatusMessage("人數上限必須是大於 0 的整數。");
      return;
    }

    if (capacityValue > 8) {
      setStatusMessage("人數上限最多 8 人，不包含負責人。");
      return;
    }

    setIsCreatingTrip(true);
    setStatusMessage("");

    const supabase = createClient();
    const { error: tripError } = await supabase.rpc("create_surf_trip", {
      target_start_date: startDate,
      target_end_date: endDate,
      target_capacity: capacityValue,
      target_min_surf_level: minSurfLevel,
      target_note: note.trim(),
      target_spot_ids: selectedSpotIds,
    });

    setIsCreatingTrip(false);

    if (tripError) {
      setStatusMessage(`新增外衝失敗：${tripError.message}`);
      return;
    }

    resetForm();
    setStatusMessage("外衝活動已新增。");
    await loadTripData();
  };

  const handleToggleAddCarForm = (tripId: string) => {
    setAddingCarTripId((current) => (current === tripId ? null : tripId));
    setNewCarCapacity("3");
  };

  const handleConfirmAddCar = async (tripId: string) => {
    if (!user) {
      setStatusMessage("請先登入。");
      return;
    }

    if (!canCreate) {
      setStatusMessage("只有正式成員可以新增車長。");
      return;
    }

    const capacityValue = Number(newCarCapacity);
    if (!Number.isInteger(capacityValue) || capacityValue < 1) {
      setStatusMessage("請輸入有效人數。");
      return;
    }

    if (capacityValue > 8) {
      setStatusMessage("人數上限最多 8 人，不包含負責人。");
      return;
    }

    setIsAddingCar(true);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("create_surf_trip_car", {
      target_trip_id: tripId,
      target_capacity: capacityValue,
    });

    setIsAddingCar(false);

    if (error) {
      setStatusMessage(`新增車長失敗：${error.message}`);
      return;
    }

    setAddingCarTripId(null);
    setNewCarCapacity("3");
    setStatusMessage("已新增車長。");
    await loadTripData();
  };

  const handleJoinSlot = async (carId: string, slotIndex: number) => {
    if (!user) {
      setStatusMessage("請先登入。");
      return;
    }

    if (!canCreate) {
      setStatusMessage("只有正式成員可以跟車。");
      return;
    }

    const joinKey = `${carId}-${slotIndex}`;
    setJoiningKey(joinKey);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("join_surf_trip_car", {
      target_car_id: carId,
      target_slot_index: slotIndex,
    });

    setJoiningKey(null);

    if (error) {
      setStatusMessage(`跟車失敗：${error.message}`);
      return;
    }

    setStatusMessage("已成功跟車。");
    await loadTripData();
  };

  const handleLeaveSlot = async (passengerId: string) => {
    if (!user) {
      setStatusMessage("請先登入。");
      return;
    }

    setLeavingPassengerId(passengerId);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("leave_surf_trip_car", {
      target_passenger_id: passengerId,
    });

    setLeavingPassengerId(null);

    if (error) {
      setStatusMessage(`取消跟車失敗：${error.message}`);
      return;
    }

    setStatusMessage("已取消跟車。");
    await loadTripData();
  };

  const handleJoinWaitlist = async (tripId: string) => {
    if (!user) {
      setStatusMessage("請先登入。");
      return;
    }

    setStatusMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("join_surf_trip_waitlist", {
      target_trip_id: tripId,
    });

    if (error) {
      setStatusMessage(`加入備取失敗：${error.message}`);
      return;
    }

    setStatusMessage("已加入備取。");
    await loadTripData();
  };

  const handleCancelWaitlist = async (tripId: string) => {
    if (!user) {
      setStatusMessage("請先登入。");
      return;
    }

    setStatusMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_surf_trip_waitlist", {
      target_trip_id: tripId,
    });

    if (error) {
      setStatusMessage(`取消備取失敗：${error.message}`);
      return;
    }

    setStatusMessage("已取消備取。");
    await loadTripData();
  };

  const handleRemoveSlot = async (carId: string, slotIndex: number) => {
    if (!user) {
      setStatusMessage("請先登入。");
      return;
    }

    const removeKey = `${carId}-${slotIndex}`;
    setRemovingSlotKey(removeKey);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("remove_surf_trip_car_slot", {
      target_car_id: carId,
      target_slot_index: slotIndex,
    });

    setRemovingSlotKey(null);

    if (error) {
      setStatusMessage(`移除車廂失敗：${error.message}`);
      return;
    }

    setStatusMessage("已移除車廂。");
    await loadTripData();
  };

  const handleDeleteTrip = async (trip: TripWithDetails) => {
    if (!user) {
      setStatusMessage("請先登入。");
      return;
    }

    if (trip.leader_id !== user.id) {
      setStatusMessage("只有活動負責人可以移除此活動。");
      return;
    }

    if (
      !window.confirm(
        "確定要移除此活動嗎？所有車隊、跟車與聊天室紀錄都會被刪除，此操作無法復原。"
      )
    ) {
      return;
    }

    setDeletingTripId(trip.id);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("delete_surf_trip", {
      target_trip_id: trip.id,
    });

    setDeletingTripId(null);

    if (error) {
      setStatusMessage(`移除活動失敗：${error.message}`);
      return;
    }

    if (chatTripId === trip.id) {
      setChatTripId(null);
    }

    setStatusMessage("活動已移除。");
    await loadTripData();
  };

  const handleStartEditLevel = (trip: TripWithDetails) => {
    setEditingLevelTripId(trip.id);
    setEditingMinSurfLevel(trip.min_surf_level ?? "");
  };

  const handleSaveLevel = async (tripId: string) => {
    if (!user) {
      setStatusMessage("請先登入。");
      return;
    }

    setIsSavingLevel(true);
    setStatusMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("update_surf_trip_min_level", {
      target_trip_id: tripId,
      new_min_surf_level: editingMinSurfLevel || null,
    });

    setIsSavingLevel(false);

    if (error) {
      setStatusMessage(`修改程度限制失敗：${error.message}`);
      return;
    }

    setEditingLevelTripId(null);
    setStatusMessage("程度限制已更新。");
    await loadTripData();
  };

  const chatTrip = trips.find((trip) => trip.id === chatTripId) ?? null;

  return (
    <main className="min-h-screen bg-appBg text-text-primary">
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
              <MapPin size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">揪外衝</h1>
              <p className="mt-1 text-sm text-text-secondary">
                正式成員可以發起外衝、新增車長，並在車廂中跟車。
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
                  請先登入後再查看與新增外衝活動。
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
                <h2 className="font-semibold text-text-primary">
                  尚未開通外衝權限
                </h2>
                <p className="mt-1 text-sm leading-6 text-text-primary/80">
                  待審核身分只能登入與填寫基本資料，尚不能使用揪外衝功能。
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6">
            {canCreate && (
              <Card>
                <div className="mb-4 flex items-center gap-2">
                  <Plus size={18} className="text-primary" strokeWidth={2} />
                  <h2 className="font-semibold text-text-primary">新增外衝</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="出發日期">
                    <input
                      type="date"
                      value={startDate}
                      min={getTaipeiDate(1)}
                      onChange={(event) => {
                        const nextStart = event.target.value;
                        setStartDate(nextStart);
                        if (endDate < nextStart) {
                          setEndDate(nextStart);
                        }
                      }}
                      className={fieldControlClasses}
                    />
                  </FormField>

                  <FormField label="回程日期">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className={fieldControlClasses}
                    />
                  </FormField>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      地點
                    </span>
                    <SpotMultiSelect
                      spots={spots}
                      selectedSpotIds={selectedSpotIds}
                      onChange={setSelectedSpotIds}
                      onCreateSpot={handleCreateSpot}
                      disabled={isCreatingTrip}
                    />
                    <span className="text-xs text-slate-400">
                      可複選、搜尋，也可新增浪點
                    </span>
                  </div>

                  <FormField
                    label="人數上限"
                    hint="不包含負責人（第一台車跟車名額），最多 8 人"
                  >
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={capacity}
                      onChange={(event) => setCapacity(event.target.value)}
                      className={fieldControlClasses}
                    />
                  </FormField>

                  <FormField label="程度限制">
                    <select
                      value={minSurfLevel}
                      onChange={(event) => setMinSurfLevel(event.target.value)}
                      className={fieldControlClasses}
                    >
                      <option value="">不限制</option>
                      {surfLevelOptions.map((level) => (
                        <option key={level} value={level}>
                          {level}以上
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="備註" className="sm:col-span-2">
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className={`min-h-24 ${fieldControlClasses}`}
                      placeholder="例如集合地點、交通方式、浪況提醒或其他注意事項"
                    />
                  </FormField>
                </div>

                <Button
                  variant="primary"
                  fullWidth
                  className="mt-5 sm:w-auto"
                  icon={<Plus size={18} />}
                  onClick={() => void handleCreateTrip()}
                  disabled={isCreatingTrip}
                >
                  {isCreatingTrip ? "新增中..." : "新增外衝"}
                </Button>
              </Card>
            )}

            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarRange size={18} className="text-primary" />
                  <h2 className="font-semibold text-text-primary">外衝列表</h2>
                </div>
                <button
                  type="button"
                  aria-label="重新整理"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-slate-700 transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => void loadTripData()}
                  disabled={isLoadingTrips}
                >
                  <RefreshCw
                    size={18}
                    className={isLoadingTrips ? "animate-spin" : ""}
                  />
                </button>
              </div>

              {isLoadingTrips ? (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <RefreshCw size={16} className="animate-spin" />
                  正在讀取外衝活動...
                </div>
              ) : trips.length === 0 ? (
                <p className="text-sm text-text-secondary">目前沒有外衝活動</p>
              ) : (
                <div className="grid gap-3">
                  {trips.map((trip) => {
                    const leader = memberProfiles.find(
                      (member) => member.id === trip.leader_id
                    );
                    const isActivityLeader = trip.leader_id === user.id;
                    const totalCapacity = trip.cars.reduce(
                      (sum, car) => sum + car.capacity,
                      0
                    );
                    const totalPassengers = trip.cars.reduce(
                      (sum, car) => sum + car.passengers.length,
                      0
                    );
                    const carsFull =
                      totalCapacity > 0 && totalPassengers >= totalCapacity;
                    const myWaitlist = trip.waitlist.find(
                      (item) => item.user_id === user.id
                    );
                    const isCarLeader = trip.cars.some(
                      (car) => car.leader_id === user.id
                    );
                    const isPassenger = trip.cars.some((car) =>
                      car.passengers.some(
                        (passenger) => passenger.user_id === user.id
                      )
                    );
                    const meetsLevel = userMeetsSurfLevel(
                      profile,
                      trip.min_surf_level
                    );
                    const waitlistFull = trip.waitlist.length >= 3;
                    const hasStarted = Boolean(trip.participation_counted_at);

                    return (
                      <div
                        key={trip.id}
                        className="rounded-xl border border-line bg-appBg p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold text-text-primary">
                              {formatDateRange(trip.start_date, trip.end_date)}
                            </p>
                            {hasStarted && (
                              <p className="mt-1 text-xs font-medium text-success">
                                已開始，車隊名單已完成外衝計次
                              </p>
                            )}
                            <p className="mt-1 text-sm text-text-secondary">
                              地點：
                              {trip.spots.length > 0
                                ? trip.spots
                                    .map((spot) => formatSpotLabel(spot))
                                    .join("、")
                                : "未指定"}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary">
                              <Users size={12} />
                              已跟 {totalPassengers} / {totalCapacity}
                            </span>
                            {carsFull && (
                              <span className="inline-flex items-center rounded-full bg-warning-light px-2.5 py-1 text-xs font-medium text-warning">
                                備取 {trip.waitlist.length} / 3
                              </span>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              className="!min-h-8 !px-2.5 !text-xs"
                              icon={<MessageCircle size={14} />}
                              onClick={() => setChatTripId(trip.id)}
                            >
                              聊天室
                            </Button>
                            {isActivityLeader && !hasStarted && (
                              <Button
                                type="button"
                                variant="danger"
                                className="!min-h-8 !px-2.5 !text-xs"
                                onClick={() => void handleDeleteTrip(trip)}
                                disabled={deletingTripId === trip.id}
                              >
                                {deletingTripId === trip.id
                                  ? "移除中..."
                                  : "移除活動"}
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-text-secondary">
                          <p>
                            負責人：
                            <span className="ml-1 font-medium text-text-primary">
                              {getMemberName(trip.leader_id)}
                            </span>
                            {leader && (
                              <span className="ml-2 inline-flex align-middle">
                                <Badge tone={getRoleTone(leader.role)}>
                                  {roleLabels[leader.role]}
                                </Badge>
                              </span>
                            )}
                          </p>
                          <p>
                            人數上限：{totalCapacity || trip.capacity}{" "}
                            人（不含車長）
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span>程度限制：</span>
                            {editingLevelTripId === trip.id ? (
                              <>
                                <select
                                  value={editingMinSurfLevel}
                                  onChange={(event) =>
                                    setEditingMinSurfLevel(event.target.value)
                                  }
                                  className={`${fieldControlClasses} !min-h-9 w-auto py-1 text-sm`}
                                  disabled={isSavingLevel}
                                >
                                  <option value="">不限制</option>
                                  {surfLevelOptions.map((level) => (
                                    <option key={level} value={level}>
                                      {level}以上
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  type="button"
                                  variant="primary"
                                  className="!min-h-8 !px-2.5 !text-xs"
                                  onClick={() => void handleSaveLevel(trip.id)}
                                  disabled={isSavingLevel}
                                >
                                  {isSavingLevel ? "儲存中..." : "儲存"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="!min-h-8 !px-2.5 !text-xs"
                                  onClick={() => setEditingLevelTripId(null)}
                                  disabled={isSavingLevel}
                                >
                                  取消
                                </Button>
                              </>
                            ) : (
                              <>
                                {trip.min_surf_level ? (
                                  <SurfLevelBadge level={trip.min_surf_level} />
                                ) : (
                                  <span className="text-text-primary">
                                    {formatMinSurfLevel(trip.min_surf_level)}
                                  </span>
                                )}
                                {trip.min_surf_level && (
                                  <span className="text-text-secondary">
                                    以上
                                  </span>
                                )}
                                {isActivityLeader && !hasStarted && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="!min-h-8 !px-2.5 !text-xs"
                                    onClick={() => handleStartEditLevel(trip)}
                                  >
                                    修改
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                          {trip.note && (
                            <p className="whitespace-pre-wrap">
                              備註：{trip.note}
                            </p>
                          )}
                        </div>

                        <TripConvoy
                          trip={trip}
                          cars={trip.cars}
                          memberProfiles={memberProfiles}
                          currentUserId={user.id}
                          currentProfile={profile}
                          canInteract={canCreate && !hasStarted}
                          isTripActivityLeader={isActivityLeader && !hasStarted}
                          joiningKey={joiningKey}
                          removingSlotKey={removingSlotKey}
                          addingCarTripId={addingCarTripId}
                          newCarCapacity={newCarCapacity}
                          isAddingCar={isAddingCar}
                          onNewCarCapacityChange={setNewCarCapacity}
                          onToggleAddCarForm={handleToggleAddCarForm}
                          onConfirmAddCar={(tripId) =>
                            void handleConfirmAddCar(tripId)
                          }
                          onJoinSlot={(carId, slotIndex) =>
                            void handleJoinSlot(carId, slotIndex)
                          }
                          onLeaveSlot={(passengerId) =>
                            void handleLeaveSlot(passengerId)
                          }
                          onRemoveSlot={(carId, slotIndex) =>
                            void handleRemoveSlot(carId, slotIndex)
                          }
                          leavingPassengerId={leavingPassengerId}
                        />

                        <div className="mt-4 border-t border-line pt-4">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-text-primary">
                              備取名單
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {hasStarted ? (
                                <span className="text-xs text-text-secondary">
                                  外衝已開始，名單已鎖定
                                </span>
                              ) : myWaitlist ? (
                                <>
                                  <span className="text-xs text-warning">
                                    備取第 {myWaitlist.waitlist_order} 位
                                  </span>
                                  <Button
                                    type="button"
                                    variant="danger"
                                    className="!min-h-8 !px-2.5 !text-xs"
                                    onClick={() =>
                                      void handleCancelWaitlist(trip.id)
                                    }
                                  >
                                    取消備取
                                  </Button>
                                </>
                              ) : carsFull &&
                                !isCarLeader &&
                                !isPassenger &&
                                meetsLevel &&
                                !waitlistFull ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="!min-h-8 !px-2.5 !text-xs"
                                  onClick={() =>
                                    void handleJoinWaitlist(trip.id)
                                  }
                                >
                                  加入備取
                                </Button>
                              ) : carsFull && waitlistFull && !myWaitlist ? (
                                <span className="text-xs text-text-secondary">
                                  備取已滿
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {!carsFull ? (
                            <p className="text-xs text-text-secondary">
                              仍有空車廂時請直接跟車，備取僅在車位已滿時開放。
                            </p>
                          ) : trip.waitlist.length === 0 ? (
                            <p className="text-xs text-text-secondary">
                              目前沒有備取。
                            </p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-line">
                              <table className="w-full min-w-[320px] text-left text-sm">
                                <thead className="bg-surface text-xs text-text-secondary">
                                  <tr>
                                    <th className="px-3 py-2">序號</th>
                                    <th className="px-3 py-2">姓名</th>
                                    <th className="px-3 py-2">程度</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {trip.waitlist.map((entry) => {
                                    const member = memberProfiles.find(
                                      (item) => item.id === entry.user_id
                                    );
                                    return (
                                      <tr
                                        key={entry.id}
                                        className="border-t border-line"
                                      >
                                        <td className="px-3 py-2">
                                          {entry.waitlist_order}
                                        </td>
                                        <td className="px-3 py-2 font-medium">
                                          {member?.full_name || "未填姓名"}
                                        </td>
                                        <td className="px-3 py-2">
                                          <SurfLevelBadge
                                            level={member?.surf_level}
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {statusMessage && (
          <Card className="mt-6 flex items-start gap-2 text-sm text-text-secondary">
            <Info size={16} className="mt-0.5 shrink-0 text-text-secondary" />
            <span>{statusMessage}</span>
          </Card>
        )}
      </div>

      {chatTrip && user && (
        <TripChatModal
          tripId={chatTrip.id}
          title={`${formatDateRange(chatTrip.start_date, chatTrip.end_date)} · ${
            chatTrip.spots.length > 0
              ? chatTrip.spots.map((spot) => formatSpotLabel(spot)).join("、")
              : "未指定地點"
          }`}
          currentUserId={user.id}
          memberProfiles={memberProfiles}
          canSend={canCreate}
          onClose={() => setChatTripId(null)}
          onError={setStatusMessage}
        />
      )}
    </main>
  );
}
