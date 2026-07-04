"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Info,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SpotMultiSelect, formatSpotLabel } from "@/components/trips/SpotMultiSelect";
import { TripCapacityPreview } from "@/components/trips/TripCapacityPreview";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, fieldControlClasses } from "@/components/ui/FormField";
import { MobileTabBar } from "@/components/ui/MobileTabBar";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { getRoleTone } from "@/lib/badgeTones";
import {
  canCreateSurfTrips,
  canManageSurfTripLeaders,
  canViewSurfTrips,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import {
  roleLabels,
  surfLevelOptions,
  type PublicMemberProfile,
  type SurfSpot,
  type SurfTrip,
  type SurfTripSpot,
} from "@/lib/types";
import { useAuthProfile } from "@/lib/useAuthProfile";

type TripWithSpots = SurfTrip & {
  spots: SurfSpot[];
};

function getTodayDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function parseLocalDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`);
}

function formatDate(dateString: string) {
  return parseLocalDate(dateString).toLocaleDateString("zh-TW", {
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
  const [trips, setTrips] = useState<TripWithSpots[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<PublicMemberProfile[]>(
    []
  );
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);

  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [selectedSpotIds, setSelectedSpotIds] = useState<string[]>([]);
  const [capacity, setCapacity] = useState("5");
  const [leaderId, setLeaderId] = useState("");
  const [minSurfLevel, setMinSurfLevel] = useState("");
  const [note, setNote] = useState("");

  const canView = canViewSurfTrips(profile);
  const canCreate = canCreateSurfTrips(profile);
  const canPickLeader = canManageSurfTripLeaders(profile);

  const capacityNumber = useMemo(() => {
    const value = Number(capacity);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }, [capacity]);

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
    const today = getTodayDate();
    setStartDate(today);
    setEndDate(today);
    setSelectedSpotIds([]);
    setCapacity("5");
    setLeaderId(user?.id ?? "");
    setMinSurfLevel("");
    setNote("");
  }, [user?.id]);

  const loadTripData = useCallback(async () => {
    setIsLoadingTrips(true);
    setStatusMessage("");

    const supabase = createClient();
    const [spotsResult, tripsResult, tripSpotsResult, membersResult] =
      await Promise.all([
        supabase
          .from("surf_spots")
          .select("id, name, county, sort_order, created_by, created_at")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("surf_trips")
          .select(
            "id, start_date, end_date, capacity, leader_id, min_surf_level, note, created_by, created_at, updated_at"
          )
          .order("start_date", { ascending: true })
          .order("created_at", { ascending: false }),
        supabase.from("surf_trip_spots").select("trip_id, spot_id"),
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

    if (membersResult.error) {
      setStatusMessage(`讀取社員公開資料失敗：${membersResult.error.message}`);
      return;
    }

    const loadedSpots = (spotsResult.data ?? []) as SurfSpot[];
    const loadedTrips = (tripsResult.data ?? []) as SurfTrip[];
    const loadedTripSpots = (tripSpotsResult.data ?? []) as SurfTripSpot[];
    const spotsById = new Map(loadedSpots.map((spot) => [spot.id, spot]));

    const tripsWithSpots: TripWithSpots[] = loadedTrips.map((trip) => ({
      ...trip,
      spots: loadedTripSpots
        .filter((item) => item.trip_id === trip.id)
        .map((item) => spotsById.get(item.spot_id))
        .filter((spot): spot is SurfSpot => Boolean(spot))
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "zh-Hant")),
    }));

    setSpots(loadedSpots);
    setTrips(tripsWithSpots);
    setMemberProfiles((membersResult.data ?? []) as PublicMemberProfile[]);
  }, [setStatusMessage]);

  useEffect(() => {
    if (!canView) return;
    queueMicrotask(() => void loadTripData());
  }, [canView, loadTripData]);

  useEffect(() => {
    if (!user) return;
    setLeaderId((current) => current || user.id);
  }, [user]);

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
      (spot) =>
        spot.name === name &&
        spot.county === county
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

    if (selectedSpotIds.length === 0) {
      setStatusMessage("請至少選擇一個地點。");
      return;
    }

    const capacityValue = Number(capacity);
    if (!Number.isInteger(capacityValue) || capacityValue < 1) {
      setStatusMessage("人數上限必須是大於 0 的整數。");
      return;
    }

    const resolvedLeaderId = canPickLeader
      ? leaderId || user.id
      : user.id;

    setIsCreatingTrip(true);
    setStatusMessage("");

    const supabase = createClient();
    const { data: tripData, error: tripError } = await supabase
      .from("surf_trips")
      .insert({
        start_date: startDate,
        end_date: endDate,
        capacity: capacityValue,
        leader_id: resolvedLeaderId,
        min_surf_level: minSurfLevel || null,
        note: note.trim() || null,
        created_by: user.id,
      })
      .select(
        "id, start_date, end_date, capacity, leader_id, min_surf_level, note, created_by, created_at, updated_at"
      )
      .single();

    if (tripError || !tripData) {
      setIsCreatingTrip(false);
      setStatusMessage(`新增外衝失敗：${tripError?.message ?? "未知錯誤"}`);
      return;
    }

    const tripId = (tripData as SurfTrip).id;
    const { error: spotsError } = await supabase.from("surf_trip_spots").insert(
      selectedSpotIds.map((spotId) => ({
        trip_id: tripId,
        spot_id: spotId,
      }))
    );

    setIsCreatingTrip(false);

    if (spotsError) {
      await supabase.from("surf_trips").delete().eq("id", tripId);
      setStatusMessage(`新增外衝地點失敗：${spotsError.message}`);
      return;
    }

    resetForm();
    setStatusMessage("外衝活動已新增。");
    await loadTripData();
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
              <MapPin size={22} strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">揪外衝</h1>
              <p className="mt-1 text-sm text-text-secondary">
                正式成員可以發起外衝活動、選擇浪點，並查看目前已建立的行程。
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

                  <FormField label="人數上限" hint="不包含負責人">
                    <input
                      type="number"
                      min="1"
                      value={capacity}
                      onChange={(event) => setCapacity(event.target.value)}
                      className={fieldControlClasses}
                    />
                  </FormField>

                  <FormField label="負責人">
                    {canPickLeader ? (
                      <select
                        value={leaderId}
                        onChange={(event) => setLeaderId(event.target.value)}
                        className={fieldControlClasses}
                      >
                        {memberProfiles.map((member) => (
                          <option key={member.id} value={member.id}>
                            {roleLabels[member.role]}（
                            {member.full_name || "未填姓名"}）
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div
                        className={`${fieldControlClasses} flex items-center bg-appBg text-text-secondary`}
                      >
                        {profile?.full_name || user.email || "目前登入者"}
                      </div>
                    )}
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

                <div className="mt-4">
                  <TripCapacityPreview capacity={capacityNumber} />
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

                    return (
                      <div
                        key={trip.id}
                        className="rounded-xl border border-line bg-appBg p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-base font-semibold text-text-primary">
                              {formatDateRange(trip.start_date, trip.end_date)}
                            </p>
                            <p className="mt-1 text-sm text-text-secondary">
                              地點：
                              {trip.spots.length > 0
                                ? trip.spots
                                    .map((spot) => formatSpotLabel(spot))
                                    .join("、")
                                : "未指定"}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary">
                            <Users size={12} />
                            {trip.capacity} 人
                          </span>
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
                            人數上限：{trip.capacity} 人（不含負責人）
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span>程度限制：</span>
                            {trip.min_surf_level ? (
                              <SurfLevelBadge level={trip.min_surf_level} />
                            ) : (
                              <span className="text-text-primary">
                                {formatMinSurfLevel(trip.min_surf_level)}
                              </span>
                            )}
                            {trip.min_surf_level && (
                              <span className="text-text-secondary">以上</span>
                            )}
                          </div>
                          {trip.note && (
                            <p className="whitespace-pre-wrap">
                              備註：{trip.note}
                            </p>
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

      <MobileTabBar />
    </main>
  );
}
