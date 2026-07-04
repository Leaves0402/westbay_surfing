export function formatTime(timeString: string) {
  return timeString.slice(0, 5);
}

export function getLessonStartDateTime(lessonDate: string, startTime: string) {
  return new Date(`${lessonDate}T${formatTime(startTime)}:00`);
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

export function formatLessonDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatLessonLabel(
  lessonDate: string,
  startTime: string,
  endTime: string
) {
  return `${formatLessonDate(lessonDate)} ${formatTime(startTime)}–${formatTime(endTime)}`;
}
