import { parseTaipeiDateTime } from "@/lib/taipeiTime";
import { localeForIntl, type AppLocale } from "@/lib/i18n";

export function formatTime(timeString: string) {
  return timeString.slice(0, 5);
}

export function getLessonStartDateTime(lessonDate: string, startTime: string) {
  return parseTaipeiDateTime(lessonDate, startTime);
}

export function hasLessonStarted(lessonDate: string, startTime: string) {
  return Date.now() >= getLessonStartDateTime(lessonDate, startTime).getTime();
}

export function isLessonCancelLocked(lessonDate: string, startTime: string) {
  const start = getLessonStartDateTime(lessonDate, startTime).getTime();
  return Date.now() >= start - 5 * 60 * 60 * 1000;
}

export function addHoursToTime(timeString: string, hours: number) {
  const [hourText, minuteText] = formatTime(timeString).split(":");
  const totalMinutes = Number(hourText) * 60 + Number(minuteText) + hours * 60;
  const nextHour = Math.floor(totalMinutes / 60) % 24;
  const nextMinute = ((totalMinutes % 60) + 60) % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

export function formatLessonDate(
  dateString: string,
  locale: AppLocale = "zh-Hant"
) {
  return new Date(`${dateString}T00:00:00+08:00`).toLocaleDateString(
    localeForIntl(locale),
    {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    }
  );
}

export function formatLessonLabel(
  lessonDate: string,
  startTime: string,
  endTime: string,
  locale: AppLocale = "zh-Hant"
) {
  return `${formatLessonDate(lessonDate, locale)} ${formatTime(startTime)}–${formatTime(endTime)}`;
}
