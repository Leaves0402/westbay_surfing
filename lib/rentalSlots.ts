import type { RentalSlot } from "@/lib/types";

/** 台灣（Asia/Taipei）固定為 UTC+8，沒有日光節約時間。 */
const TAIPEI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

type RentalSlotSchedule = Pick<RentalSlot, "rental_date" | "start_time">;

export function formatRentalTime(timeString: string) {
  return timeString.slice(0, 5);
}

/** 以台灣時間取得今天的日期字串（YYYY-MM-DD）。 */
export function getTaipeiTodayDate(nowMs: number = Date.now()) {
  return new Date(nowMs + TAIPEI_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 以台灣時間計算時段開始的絕對時間；日期或時間格式異常時回傳 NaN。
 */
export function getRentalSlotStartTimestamp(slot: RentalSlotSchedule) {
  return Date.parse(
    `${slot.rental_date}T${formatRentalTime(slot.start_time)}:00+08:00`
  );
}

/**
 * 以台灣時間判斷時段是否已過期（現在時間已達開始時間）。
 * 「已過期」是獨立且優先於 is_open 的狀態，不需要把 is_open 寫成 false。
 */
export function isRentalSlotExpired(
  slot: RentalSlotSchedule,
  nowMs: number = Date.now()
) {
  const startTimestamp = getRentalSlotStartTimestamp(slot);
  if (Number.isNaN(startTimestamp)) return false;
  return nowMs >= startTimestamp;
}

/** 新增時段用：開始時間必須晚於目前台灣時間。 */
export function isRentalSlotStartInFuture(
  slot: RentalSlotSchedule,
  nowMs: number = Date.now()
) {
  const startTimestamp = getRentalSlotStartTimestamp(slot);
  if (Number.isNaN(startTimestamp)) return false;
  return startTimestamp > nowMs;
}

export const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

export function parseLocalDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`);
}

export function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatRentalDate(dateString: string) {
  return parseLocalDate(dateString).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

export function formatRentalShortDate(dateString: string) {
  return parseLocalDate(dateString).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatRentalMonth(date: Date) {
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
  });
}

export function getCalendarCells(monthCursor: Date) {
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
