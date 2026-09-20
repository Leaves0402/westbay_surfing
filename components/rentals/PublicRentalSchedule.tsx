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
  Lock,
  RefreshCw,
  Users,
} from "lucide-react";
import { GuestRentalFlow } from "@/components/rentals/GuestRentalFlow";
import { GuestReservationLookup } from "@/components/rentals/GuestReservationLookup";
import { useLanguage } from "@/components/LanguageProvider";
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getSurfLevelTone, toneDotClasses } from "@/lib/badgeTones";
import type { PublicRentalSlot } from "@/lib/guestRentals";
import {
  formatRentalDate,
  formatRentalMonth,
  formatRentalTime,
  getCalendarCells,
  getWeekdayLabels,
  getTaipeiTodayDate,
  isRentalSlotExpired,
  parseLocalDate,
  toDateString,
} from "@/lib/rentalSlots";
import { createClient } from "@/lib/supabase/client";

const EXPIRATION_TICK_MS = 30_000;

export function PublicRentalSchedule({
  mode,
}: {
  mode: "guest" | "pending";
}) {
  const { locale } = useLanguage();
  const weekdayLabels = getWeekdayLabels(locale);
  const [slots, setSlots] = useState<PublicRentalSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [monthCursor, setMonthCursor] = useState(() =>
    parseLocalDate(getTaipeiTodayDate())
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [guestFlowSlotId, setGuestFlowSlotId] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const supabase = createClient();
    const cells = getCalendarCells(monthCursor);
    const firstCell = cells[0];
    const lastCell = cells[cells.length - 1];
    const range = {
      target_start_date: firstCell
        ? toDateString(firstCell.date)
        : getTaipeiTodayDate(),
      target_end_date: lastCell
        ? toDateString(lastCell.date)
        : getTaipeiTodayDate(),
    };

    let { data, error } = await supabase.rpc(
      "get_public_rental_schedule_details_range",
      range
    );

    if (
      error &&
      (error.code === "PGRST202" ||
        error.message.includes("get_public_rental_schedule_details_range"))
    ) {
      const fallback = await supabase.rpc("get_public_rental_schedule_range", range);
      data = (fallback.data ?? []).map((slot: Omit<PublicRentalSlot, "registrations" | "taken_surfboard_ids">) => ({
        ...slot,
        registrations: [],
        taken_surfboard_ids: [],
      }));
      error = fallback.error;
    }

    setIsLoading(false);

    if (error) {
      setErrorMessage(`讀取公開租板時段失敗：${error.message}`);
      return;
    }

    const loadedSlots = (data ?? []) as PublicRentalSlot[];
    setSlots(loadedSlots);
    setSelectedSlotId((current) => {
      if (current && loadedSlots.some((slot) => slot.id === current)) {
        return current;
      }
      const upcoming = loadedSlots.find(
        (slot) => !isRentalSlotExpired(slot, Date.now())
      );
      return (upcoming ?? loadedSlots[0])?.id ?? null;
    });
  }, [monthCursor]);

  useEffect(() => {
    queueMicrotask(() => void loadSchedule());
  }, [loadSchedule]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), EXPIRATION_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const today = getTaipeiTodayDate(currentTime);
  const calendarCells = useMemo(() => getCalendarCells(monthCursor), [monthCursor]);
  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.id === selectedSlotId) ?? null,
    [selectedSlotId, slots]
  );
  const guestFlowSlot = useMemo(
    () => slots.find((slot) => slot.id === guestFlowSlotId) ?? null,
    [guestFlowSlotId, slots]
  );

  const moveMonth = (offset: number) => {
    setSelectedSlotId(null);
    setMonthCursor(
      (current) =>
        new Date(
          Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)
        )
    );
  };

  return (
    <>
      <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Card className="min-w-0 overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <h2 className="font-semibold text-slate-900">租板日曆</h2>
              <p className="mt-1 text-sm text-slate-500">
                點擊日期格中的時段查看名額與登記狀況。
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" className="px-2.5" aria-label="上個月" onClick={() => moveMonth(-1)}>
                <ChevronLeft size={18} />
              </Button>
              <p className="min-w-24 text-center text-sm font-semibold text-slate-800">
                {formatRentalMonth(monthCursor, locale)}
              </p>
              <Button variant="outline" className="px-2.5" aria-label="下個月" onClick={() => moveMonth(1)}>
                <ChevronRight size={18} />
              </Button>
              <Button variant="outline" className="px-2.5" aria-label="重新整理" onClick={() => void loadSchedule()}>
                <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <p className="flex items-center gap-2 p-6 text-sm text-slate-500">
              <RefreshCw size={16} className="animate-spin" />正在讀取租板時段...
            </p>
          ) : (
            <div className="grid min-w-0 grid-cols-7">
              {weekdayLabels.map((weekday) => (
                <div key={weekday} className="border-b border-border bg-bg py-2 text-center text-xs font-semibold text-slate-500">
                  {weekday}
                </div>
              ))}

              {calendarCells.map((cell) => {
                const slotsForDay = slots.filter((slot) => slot.rental_date === cell.dateString);
                const isToday = cell.dateString === today;

                return (
                  <div
                    key={cell.dateString}
                    className={`min-h-[84px] border-b border-r border-border p-1.5 last:border-r-0 sm:min-h-[104px] sm:p-2 ${
                      cell.isCurrentMonth ? "bg-surface" : "bg-bg"
                    }`}
                  >
                    <span className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday
                        ? "bg-primary text-white"
                        : cell.isCurrentMonth
                          ? "text-slate-700"
                          : "text-slate-300"
                    }`}>
                      {cell.date.getDate()}
                    </span>

                    <div className="flex flex-col gap-1">
                      {slotsForDay.map((slot) => {
                        const expired = isRentalSlotExpired(slot, currentTime);
                        const available = !expired && slot.is_open && slot.remaining_capacity > 0;
                        const tone = getSurfLevelTone(slot.min_surf_level);
                        const isSelected = selectedSlotId === slot.id;

                        return (
                          <button
                            type="button"
                            key={slot.id}
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={`w-full min-w-0 rounded-lg border px-0.5 py-1 text-left text-[9px] leading-tight transition-colors sm:px-1.5 sm:text-[11px] ${
                              isSelected
                                ? "border-primary bg-primary-light"
                                : available
                                  ? "border-border bg-surface hover:border-primary/50"
                                  : "border-border bg-bg text-slate-400"
                            }`}
                          >
                            <span className="flex min-w-0 items-center justify-center font-semibold text-slate-700 sm:justify-start sm:gap-1">
                              <span className={`hidden h-1.5 w-1.5 shrink-0 rounded-full sm:block ${toneDotClasses[tone]}`} />
                              <span className="truncate">{formatRentalTime(slot.start_time)}</span>
                            </span>
                            <span className="mt-0.5 block text-slate-500">{slot.registration_count}/{slot.capacity}</span>
                            {expired ? (
                              <span className="mt-0.5 block text-slate-400">已過期</span>
                            ) : !slot.is_open ? (
                              <span className="mt-0.5 block text-slate-400">未開放</span>
                            ) : null}
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

        <div className="grid min-w-0 gap-6">
          {selectedSlot ? (
            <PublicSlotDetail
              slot={selectedSlot}
              isExpired={isRentalSlotExpired(selectedSlot, currentTime)}
              mode={mode}
              onGuestRegister={() => setGuestFlowSlotId(selectedSlot.id)}
            />
          ) : (
            <Card className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bg text-slate-400">
                <CalendarDays size={22} strokeWidth={1.75} />
              </span>
              <h2 className="font-semibold text-slate-900">目前沒有租板時段</h2>
              <p className="max-w-xs text-sm leading-6 text-slate-500">
                這個月份尚未建立租板時段，可切換月份後再查看。
              </p>
            </Card>
          )}

          <Card className="border-primary/20 bg-primary-light/40">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Lock size={18} strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="font-semibold text-slate-900">
                  {mode === "guest" ? "非社員也可以登記租板" : "等待社員審核中"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {mode === "guest"
                    ? "不需 Google 登入。非社員一律視為初階，費用每次 200 元；完成閱讀說明、填寫聯絡資料並選板後即可登記。"
                    : "待審核帳號目前只能查看公開時段。若要使用非社員流程，請先登出；審核通過後可使用社員租板功能。"}
                </p>
              </div>
            </div>
          </Card>

          {mode === "guest" && (
            <GuestReservationLookup onReservationChanged={loadSchedule} />
          )}

          {errorMessage && (
            <Card className="flex items-start gap-2 text-sm text-slate-600">
              <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <span>{errorMessage}</span>
            </Card>
          )}
        </div>
      </section>

      {mode === "guest" && guestFlowSlot && (
        <GuestRentalFlow
          slot={guestFlowSlot}
          onClose={() => setGuestFlowSlotId(null)}
          onSuccess={loadSchedule}
        />
      )}
    </>
  );
}

function PublicSlotDetail({
  slot,
  isExpired,
  mode,
  onGuestRegister,
}: {
  slot: PublicRentalSlot;
  isExpired: boolean;
  mode: "guest" | "pending";
  onGuestRegister: () => void;
}) {
  const { locale } = useLanguage();
  const isFull = slot.remaining_capacity <= 0;
  const guestMeetsLevel = !slot.min_surf_level || slot.min_surf_level === "初階";
  const registrationRows = Array.from(
    { length: Math.max(slot.capacity, slot.registrations.length) },
    (_, index) => slot.registrations[index] ?? null
  );

  return (
    <Card className="min-w-0">
      <h2 className="text-lg font-semibold text-slate-900">時段詳細資料</h2>
      <p className="mt-1 text-sm text-slate-500">
        {formatRentalDate(slot.rental_date, locale)}
      </p>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <Clock size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div><dt className="text-xs text-slate-500">時間</dt><dd className="mt-0.5 font-medium text-slate-800">{formatRentalTime(slot.start_time)}–{formatRentalTime(slot.end_time)}</dd></div>
        </div>
        <div className="flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div><dt className="text-xs text-slate-500">開放狀態</dt><dd className="mt-0.5"><Badge tone={isExpired || !slot.is_open ? "neutral" : "success"}>{isExpired ? "已過期" : slot.is_open ? "開放中" : "已關閉"}</Badge></dd></div>
        </div>
        <div className="flex items-start gap-2">
          <Gauge size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div><dt className="text-xs text-slate-500">最低程度</dt><dd className="mt-0.5">{slot.min_surf_level ? <span className="inline-flex items-center gap-2"><SurfLevelBadge level={slot.min_surf_level} /><span className="text-slate-500">以上</span></span> : <span className="text-slate-500">不限制</span>}</dd></div>
        </div>
        <div className="flex items-start gap-2">
          <Users size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div><dt className="text-xs text-slate-500">名額</dt><dd className="mt-0.5 flex flex-wrap items-center gap-2 font-medium text-slate-800">{slot.registration_count}/{slot.capacity}{isFull ? <Badge tone="warning">已額滿</Badge> : <Badge tone="info">剩 {slot.remaining_capacity} 位</Badge>}</dd></div>
        </div>
      </dl>

      <div className="mt-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
          <Users size={16} className="text-slate-400" />登記名單
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[500px] border-collapse text-center text-sm">
            <thead><tr className="border-b border-border bg-bg text-xs text-slate-500"><th className="px-3 py-2 font-medium">編號</th><th className="px-3 py-2 font-medium">姓名</th><th className="px-3 py-2 font-medium">身分</th><th className="px-3 py-2 font-medium">程度</th><th className="px-3 py-2 font-medium">繳費</th><th className="px-3 py-2 font-medium">衝浪板</th></tr></thead>
            <tbody>
              {registrationRows.map((registration, index) => (
                <tr key={registration?.id ?? `public-empty-${slot.id}-${index}`} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                  <td translate="no" className="px-3 py-3 font-medium text-slate-800">{registration?.display_name ?? "空位"}</td>
                  <td className="px-3 py-3 text-slate-600">{registration ? (registration.renter_type === "guest" ? "非社員" : "社員") : "-"}</td>
                  <td className="px-3 py-3">{registration?.surf_level ? <SurfLevelBadge level={registration.surf_level} /> : <span className="text-slate-400">-</span>}</td>
                  <td className="px-3 py-3">{registration ? <Badge tone={registration.is_paid ? "success" : "warning"}>{registration.is_paid ? "已繳" : "未繳"}</Badge> : <span className="text-slate-400">-</span>}</td>
                  <td translate="no" className="px-3 py-3 text-slate-600">{registration?.surfboard_name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          公開名單只顯示遮罩姓名，不顯示社員學號或非社員電話。
        </p>
      </div>

      <div className="mt-5">
        <Button
          variant="primary"
          fullWidth
          className="sm:w-auto"
          onClick={onGuestRegister}
          disabled={mode === "pending" || isExpired || !slot.is_open || isFull || !guestMeetsLevel}
        >
          登記租板
        </Button>

        <div className="mt-3 flex flex-col gap-1.5 text-xs text-slate-500">
          {!guestMeetsLevel && <p className="flex items-center gap-1.5"><Info size={13} />非社員固定為初階，無法登記最低程度較高的時段。</p>}
          {isExpired && <p className="flex items-center gap-1.5"><Info size={13} />此租板時段已過期，無法登記。</p>}
          {!isExpired && !slot.is_open && <p className="flex items-center gap-1.5"><Info size={13} />此時段目前未開放登記。</p>}
          {!isExpired && slot.is_open && isFull && <p className="flex items-center gap-1.5"><Info size={13} />此時段已額滿。</p>}
        </div>
      </div>
    </Card>
  );
}
