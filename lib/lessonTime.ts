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

export function parseLessonRegistrationDeadline(value: string) {
  const [date, time] = value.split("T");
  return parseTaipeiDateTime(date, time);
}

export function toTaipeiDateTimeLocalValue(timestampMs: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function getDefaultLessonRegistrationDeadline(
  lessonDate: string,
  startTime: string
) {
  const start = getLessonStartDateTime(lessonDate, startTime).getTime();
  return toTaipeiDateTimeLocalValue(start - 5 * 60 * 60 * 1000);
}

export function hasLessonRegistrationClosed(registrationDeadline: string) {
  return Date.now() >= new Date(registrationDeadline).getTime();
}

export function getLessonCancellationDeadline(registrationDeadline: string) {
  return new Date(registrationDeadline).getTime() - 3 * 60 * 60 * 1000;
}

export function isLessonCancellationLocked(registrationDeadline: string) {
  return Date.now() >= getLessonCancellationDeadline(registrationDeadline);
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

export function formatLessonDeadline(
  deadline: string | number,
  locale: AppLocale = "zh-Hant"
) {
  return new Date(deadline).toLocaleString(localeForIntl(locale), {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
