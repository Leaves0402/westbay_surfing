const TAIPEI_TIME_ZONE = "Asia/Taipei";
const TAIPEI_OFFSET = "+08:00";

export function getTaipeiDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function parseTaipeiDateTime(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 5)}:00${TAIPEI_OFFSET}`);
}

