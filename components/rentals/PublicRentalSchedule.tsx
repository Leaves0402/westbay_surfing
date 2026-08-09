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
import { SurfLevelBadge } from "@/components/SurfLevelBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getSurfLevelTone, toneDotClasses } from "@/lib/badgeTones";
import {
  formatRentalDate,
  formatRentalMonth,
  formatRentalTime,
  getCalendarCells,
  getTaipeiTodayDate,
  isRentalSlotExpired,
  parseLocalDate,
  toDateString,
  weekdayLabels,
} from "@/lib/rentalSlots";
import { createClient } from "@/lib/supabase/client";

const EXPIRATION_TICK_MS = 30_000;

/**
 * 公開租板摘要（不含個資）。
 * 只透過 get_public_rental_schedule RPC 取得資料，
 * 不會讀取 rental_registrations、profiles 等含個資的資料表。
 */
export type PublicRentalSlot = {
  id: string;
  rental_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  min_surf_level: string | null;
  is_open: boolean;
  registration_count: number;
  remaining_capacity: number;
};

export function PublicRentalSchedule({
  /** 未登入時顯示登入提示；待審核身分顯示等待審核提示。 */
  mode,
  onRequireLogin,
}: {
  mode: "guest" | "pending";
  onRequireLogin: () => void;
}) {
  const [slots, setSlots] = useState<PublicRentalSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [monthCursor, setMonthCursor] = useState(() =>
    parseLocalDate(getTaipeiTodayDate())
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const supabase = createClient();
    const cells = getCalendarCells(monthCursor);
    const firstCell = cells[0];
    const lastCell = cells[cells.length - 1];
    let { data, error } = await supabase.rpc(
      "get_public_rental_schedule_range",
      {
        target_start_date: firstCell
          ? toDateString(firstCell.date)
          : getTaipeiTodayDate(),
        target_end_date: lastCell
          ? toDateString(lastCell.date)
          : getTaipeiTodayDate(),
      }
    );

    // During a staggered rollout, keep the public page usable until the new
    // range RPC migration reaches Supabase.
    if (
      error &&
      (error.code === "PGRST202" ||
        error.message.includes("get_public_rental_schedule_range"))
    ) {
      const fallbackResult = await supabase.rpc("get_public_rental_schedule");
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    setIsLoading(false);

    if (error) {
      setErrorMessage(`讀取公開租板時段失敗：${error.message}`);
      return;
    }

    setSlots((data ?? []) as PublicRentalSlot[]);
  }, [monthCursor]);

  useEffect(() => {
    queueMicrotask(() => void loadSchedule());
  }, [loadSchedule]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, EXPIRATION_TICK_MS);

    return () => clearInterval(timer);
  }, []);

  const today = getTaipeiTodayDate(currentTime);
  const calendarCells = useMemo(
    () => getCalendarCells(monthCursor),
    [monthCursor]
  );

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.id === selectedSlotId) ?? null,
    [selectedSlotId, slots]
  );

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

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-semibold text-slate-900">租板日曆</h2>
            <p className="mt-1 text-sm text-slate-500">
              點擊日期格中的時段查看公開資訊。
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
              {formatRentalMonth(monthCursor)}
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
              onClick={() => void loadSchedule()}
            >
              <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="flex items-center gap-2 p-6 text-sm text-slate-500">
            <RefreshCw size={16} className="animate-spin" />
            正在讀取租板時段...
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
              const slotsForDay = slots.filter(
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
                  <span
                    className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday
                        ? "bg-primary text-white"
                        : cell.isCurrentMonth
                          ? "text-slate-700"
                          : "text-slate-300"
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>

                  <div className="flex flex-col gap-1">
                    {slotsForDay.map((slot) => {
                      const expired = isRentalSlotExpired(slot, currentTime);
                      const isFull = slot.remaining_capacity <= 0;
                      const isAvailable = !expired && slot.is_open && !isFull;
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
                              : isAvailable
                                ? "border-border bg-surface hover:border-primary/50"
                                : "border-border bg-bg text-slate-400"
                          }`}
                        >
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDotClasses[tone]}`}
                            />
                            <span className="truncate">
                              {formatRentalTime(slot.start_time)}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-slate-500">
                            {slot.registration_count}/{slot.capacity}
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
          <PublicSlotDetail
            slot={selectedSlot}
            isExpired={isRentalSlotExpired(selectedSlot, currentTime)}
            mode={mode}
            onRequireLogin={onRequireLogin}
          />
        ) : (
          <Card className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bg text-slate-400">
              <CalendarDays size={22} strokeWidth={1.75} />
            </span>
            <h2 className="font-semibold text-slate-900">時段公開資訊</h2>
            <p className="max-w-xs text-sm leading-6 text-slate-500">
              請從日曆選擇一個租板時段查看時間、名額與最低程度。
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
                {mode === "guest" ? "登入後可以登記租板" : "等待審核中"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {mode === "guest"
                  ? "這裡只顯示公開的時段與名額。登入並經幹部審核後，就可以查看登記名單、挑選衝浪板並登記租板。"
                  : "你目前是待審核身分，只能查看公開的時段與名額。審核通過後就可以挑選衝浪板並登記租板。"}
              </p>
              {mode === "guest" && (
                <Button
                  variant="primary"
                  className="mt-4 sm:w-auto"
                  fullWidth
                  onClick={onRequireLogin}
                >
                  Google 登入
                </Button>
              )}
            </div>
          </div>
        </Card>

        {errorMessage && (
          <Card className="flex items-start gap-2 text-sm text-slate-600">
            <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <span>{errorMessage}</span>
          </Card>
        )}
      </div>
    </section>
  );
}

function PublicSlotDetail({
  slot,
  isExpired,
  mode,
  onRequireLogin,
}: {
  slot: PublicRentalSlot;
  isExpired: boolean;
  mode: "guest" | "pending";
  onRequireLogin: () => void;
}) {
  const isFull = slot.remaining_capacity <= 0;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">時段公開資訊</h2>
      <p className="mt-1 text-sm text-slate-500">
        {formatRentalDate(slot.rental_date)}
      </p>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <Clock size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">時間</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {formatRentalTime(slot.start_time)}-
              {formatRentalTime(slot.end_time)}
            </dd>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">開放狀態</dt>
            <dd className="mt-0.5">
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
          <Gauge size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">最低程度</dt>
            <dd className="mt-0.5">
              {slot.min_surf_level ? (
                <span className="inline-flex items-center gap-2">
                  <SurfLevelBadge level={slot.min_surf_level} />
                  <span className="text-slate-500">以上</span>
                </span>
              ) : (
                <span className="text-slate-500">不限制</span>
              )}
            </dd>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Users size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <dt className="text-xs text-slate-500">名額</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-medium text-slate-800">
              {slot.registration_count}/{slot.capacity}
              {isFull ? (
                <Badge tone="warning">已額滿</Badge>
              ) : (
                <Badge tone="info">剩 {slot.remaining_capacity} 位</Badge>
              )}
            </dd>
          </div>
        </div>
      </dl>

      <div className="mt-5">
        <Button
          variant="primary"
          fullWidth
          className="sm:w-auto"
          onClick={onRequireLogin}
          disabled={mode === "pending" || isExpired || !slot.is_open || isFull}
        >
          登記租板
        </Button>

        <div className="mt-3 flex flex-col gap-1.5">
          {isExpired && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Info size={13} />
              此租板時段已過期，無法登記
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
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Info size={13} />
            {mode === "guest"
              ? "登入並通過審核後才會顯示登記名單與衝浪板。"
              : "審核通過後才可以登記並查看登記名單。"}
          </p>
        </div>
      </div>
    </Card>
  );
}
