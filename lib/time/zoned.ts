function localDateKey(value: Date, timezone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function startOfLocalDate(dateKey: string, timezone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day);
  let instant = targetWallTime;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const representedWallTime = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    instant -= representedWallTime - targetWallTime;
  }

  return new Date(instant);
}

export function startOfLocalDay(value: Date, timezone: string) {
  return startOfLocalDate(localDateKey(value, timezone), timezone);
}

export function localDayRange(dateKey: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new RangeError("Invalid local date");
  const [year, month, day] = dateKey.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) throw new RangeError("Invalid local date");
  const nextDateKey = new Date(calendarDate.getTime() + 86_400_000).toISOString().slice(0, 10);
  return { from: startOfLocalDate(dateKey, timezone), to: startOfLocalDate(nextDateKey, timezone) };
}
