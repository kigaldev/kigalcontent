import type { BestTimeHeatmapResponse } from "@/types/engine";

export const COMMON_TIMEZONES = [
  "Europe/Madrid",
  "America/Mexico_City",
  "America/Bogota",
  "America/Buenos_Aires",
  "America/New_York",
  "UTC",
] as const;

export type CommonTimezone = (typeof COMMON_TIMEZONES)[number];

export const TIMEZONE_LABELS: Record<string, string> = {
  "Europe/Madrid": "Europe/Madrid (CET/CEST)",
  "America/Mexico_City": "America/Mexico_City (CDMX)",
  "America/Bogota": "America/Bogota (COT)",
  "America/Buenos_Aires": "America/Buenos_Aires (ART)",
  "America/New_York": "America/New_York (EST/EDT)",
  UTC: "UTC (Tiempo Universal)",
};

export const WEEKDAY_SHORT_ES = [
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
  "Dom",
] as const;

export const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

interface TemporalInstantLike {
  epochMilliseconds: number;
  toString(): string;
  toZonedDateTimeISO(timeZone: string): TemporalZonedDateTimeLike;
}

interface TemporalZonedDateTimeLike {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number; // 1 = Monday .. 7 = Sunday
  epochMilliseconds: number;
  withTimeZone(timeZone: string): TemporalZonedDateTimeLike;
  toInstant(): TemporalInstantLike;
  toString(): string;
}

interface TemporalNamespaceLike {
  ZonedDateTime?: {
    from(
      item: string,
      options?: { disambiguation?: "compatible" | "earlier" | "later" | "reject" }
    ): TemporalZonedDateTimeLike;
  };
  Instant?: {
    from(iso: string): TemporalInstantLike;
    fromEpochMilliseconds(epochMs: number): TemporalInstantLike;
  };
}

function getTemporal(): TemporalNamespaceLike | undefined {
  return (globalThis as { Temporal?: TemporalNamespaceLike }).Temporal;
}

function pad2(n: number): string {
  return String(Math.trunc(n)).padStart(2, "0");
}

function normalizeTimeZone(tz: string): string {
  const candidate = tz?.trim() || "Europe/Madrid";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}

function parseInputDate(isoOrDate: string | Date): Date {
  if (isoOrDate instanceof Date) {
    return Number.isFinite(isoOrDate.getTime()) ? isoOrDate : new Date();
  }
  const raw = (isoOrDate ?? "").trim();
  if (!raw) return new Date();

  // If ISO string lacks timezone offset (e.g. SQLite UTC naive timestamp), treat as UTC
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2}|\[.+\])$/i.test(raw);
  const normalized = !hasOffset && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw)
    ? `${raw.replace(" ", "T")}Z`
    : raw;

  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

interface TzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekdayMonFirst: number;
}

const WEEKDAY_EN_TO_MON_FIRST: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function getPartsInTz(isoOrDate: string | Date, tz: string): TzParts {
  const safeTz = normalizeTimeZone(tz);
  const temporal = getTemporal();

  if (temporal?.ZonedDateTime && typeof isoOrDate === "string" && isoOrDate.includes("[")) {
    try {
      const zdt = temporal.ZonedDateTime.from(isoOrDate, {
        disambiguation: "compatible",
      }).withTimeZone(safeTz);
      return {
        year: zdt.year,
        month: zdt.month,
        day: zdt.day,
        hour: zdt.hour,
        minute: zdt.minute,
        second: zdt.second,
        weekdayMonFirst: Math.max(0, Math.min(6, zdt.dayOfWeek - 1)),
      };
    } catch {
      // Fallback below
    }
  }

  const dateObj = parseInputDate(isoOrDate);

  if (temporal?.Instant) {
    try {
      const zdt = temporal.Instant.fromEpochMilliseconds(
        dateObj.getTime()
      ).toZonedDateTimeISO(safeTz);
      return {
        year: zdt.year,
        month: zdt.month,
        day: zdt.day,
        hour: zdt.hour,
        minute: zdt.minute,
        second: zdt.second,
        weekdayMonFirst: Math.max(0, Math.min(6, zdt.dayOfWeek - 1)),
      };
    } catch {
      // Fallback to Intl.DateTimeFormat
    }
  }

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });

  const parts = dtf.formatToParts(dateObj);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = p.value;
    }
  }

  const hourNum = Number(map.hour ?? 0) % 24;
  return {
    year: Number(map.year ?? dateObj.getUTCFullYear()),
    month: Number(map.month ?? dateObj.getUTCMonth() + 1),
    day: Number(map.day ?? dateObj.getUTCDate()),
    hour: hourNum,
    minute: Number(map.minute ?? 0),
    second: Number(map.second ?? 0),
    weekdayMonFirst: WEEKDAY_EN_TO_MON_FIRST[map.weekday ?? "Mon"] ?? 0,
  };
}

/**
 * Formats a Date (or ISO string) into YYYY-MM-DD in the given IANA timezone.
 */
export function formatDateKey(date: Date | string, tz: string): string {
  const p = getPartsInTz(date, tz);
  return `${String(p.year).padStart(4, "0")}-${pad2(p.month)}-${pad2(p.day)}`;
}

/**
 * Formats an ISO string or Date into 24-hour HH:MM in the given IANA timezone.
 */
export function formatTimeInTz(isoOrDate: string | Date, tz: string): string {
  const p = getPartsInTz(isoOrDate, tz);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * Returns the 0..23 hour in the given IANA timezone.
 */
export function getHourInTz(isoOrDate: string | Date, tz: string): number {
  return getPartsInTz(isoOrDate, tz).hour;
}

/**
 * Returns day-of-week index where 0 = Lunes .. 6 = Domingo in the given IANA timezone.
 */
export function getDayOfWeekMonFirst(isoOrDate: string | Date, tz: string): number {
  return getPartsInTz(isoOrDate, tz).weekdayMonFirst;
}

/**
 * Converts a wall-clock YYYY-MM-DD + HH:MM in an IANA timezone into a UTC ISO string.
 * Uses Temporal.ZonedDateTime (disambiguation: "compatible") when available,
 * with a two-pass Intl.DateTimeFormat DST-safe fallback for Safari/older engines.
 */
export function buildLocalDateTimeToUtcIso(
  dateStr: string,
  timeStr: string,
  tz: string
): string {
  const safeTz = normalizeTimeZone(tz);
  const [yStr, mStr, dStr] = dateStr.split("-");
  const [hhStr = "09", mmStr = "00", ssStr = "00"] = timeStr.split(":");

  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const hour = Number(hhStr);
  const minute = Number(mmStr);
  const second = Number(ssStr) || 0;

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date().toISOString();
  }

  const normalizedDate = `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
  const normalizedTime = `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;

  const temporal = getTemporal();
  if (temporal?.ZonedDateTime) {
    try {
      const zdt = temporal.ZonedDateTime.from(
        `${normalizedDate}T${normalizedTime}[${safeTz}]`,
        { disambiguation: "compatible" }
      );
      return zdt.withTimeZone("UTC").toInstant().toString();
    } catch {
      // Fallback to Intl resolution below
    }
  }

  const targetWallUtc = Date.UTC(year, month - 1, day, hour, minute, second);

  const offsetAt = (utcMs: number): number => {
    const p = getPartsInTz(new Date(utcMs), safeTz);
    const wallMs = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return wallMs - utcMs;
  };

  const firstGuess = targetWallUtc - offsetAt(targetWallUtc);
  const secondOffset = offsetAt(firstGuess);
  const finalUtcMs = targetWallUtc - secondOffset;

  return new Date(finalUtcMs).toISOString();
}

function addCalendarDays(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return `${String(dt.getUTCFullYear()).padStart(4, "0")}-${pad2(
    dt.getUTCMonth() + 1
  )}-${pad2(dt.getUTCDate())}`;
}

export interface WeekDayInfo {
  dateStr: string;
  dayName: string;
  dayNumber: string;
  weekdayIdx: number;
  isToday: boolean;
}

/**
 * Returns the 7 Monday-through-Sunday days containing anchorDate.
 */
export function getWeekDays(anchorDate: Date, tz = "Europe/Madrid"): WeekDayInfo[] {
  const safeTz = normalizeTimeZone(tz);
  const anchorStr = formatDateKey(anchorDate, safeTz);
  const anchorWeekday = getDayOfWeekMonFirst(anchorDate, safeTz);
  const mondayStr = addCalendarDays(anchorStr, -anchorWeekday);
  const todayStr = formatDateKey(new Date(), safeTz);

  return Array.from({ length: 7 }, (_, idx) => {
    const dateStr = addCalendarDays(mondayStr, idx);
    const dayNum = Number(dateStr.split("-")[2]);
    return {
      dateStr,
      dayName: WEEKDAY_SHORT_ES[idx],
      dayNumber: String(dayNum),
      weekdayIdx: idx,
      isToday: dateStr === todayStr,
    };
  });
}

export interface MonthCellInfo {
  dateStr: string;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
}

/**
 * Returns a Monday-first calendar grid (35 or 42 days) covering the month of anchorDate.
 */
export function getMonthGrid(anchorDate: Date, tz = "Europe/Madrid"): MonthCellInfo[] {
  const safeTz = normalizeTimeZone(tz);
  const anchorParts = getPartsInTz(anchorDate, safeTz);
  const year = anchorParts.year;
  const month = anchorParts.month;

  const firstOfMonthStr = `${String(year).padStart(4, "0")}-${pad2(month)}-01`;
  const firstNoonUtc = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const firstWeekday = (firstNoonUtc.getUTCDay() + 6) % 7; // 0=Mon .. 6=Sun

  const daysInMonth = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
  const totalCells = firstWeekday + daysInMonth > 35 ? 42 : 35;
  const gridStartStr = addCalendarDays(firstOfMonthStr, -firstWeekday);
  const todayStr = formatDateKey(new Date(), safeTz);

  return Array.from({ length: totalCells }, (_, idx) => {
    const dateStr = addCalendarDays(gridStartStr, idx);
    const [cellY, cellM, cellD] = dateStr.split("-").map(Number);
    return {
      dateStr,
      dayNum: cellD,
      inMonth: cellY === year && cellM === month,
      isToday: dateStr === todayStr,
    };
  });
}

/**
 * Finds the next highest-scoring future slot across the next 7 days from a BestTimeHeatmapResponse.
 */
export function findNextBestSlot(
  heatmap: BestTimeHeatmapResponse,
  tz: string
): { dateStr: string; timeStr: string; score: number } {
  const safeTz = normalizeTimeZone(tz);
  const now = new Date();
  const todayParts = getPartsInTz(now, safeTz);
  const todayStr = formatDateKey(now, safeTz);

  const scoreByDayHour = new Map<string, number>();
  for (const slot of heatmap.grid ?? []) {
    scoreByDayHour.set(`${slot.day_of_week}-${slot.hour}`, slot.score);
  }

  let best: { dateStr: string; timeStr: string; score: number } | null = null;

  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const dateStr = addCalendarDays(todayStr, dayOffset);
    const weekdayIdx = (todayParts.weekdayMonFirst + dayOffset) % 7;

    for (let hour = 7; hour <= 22; hour++) {
      if (dayOffset === 0 && hour <= todayParts.hour) {
        continue;
      }
      const score = scoreByDayHour.get(`${weekdayIdx}-${hour}`) ?? 0;
      if (!best || score > best.score) {
        best = {
          dateStr,
          timeStr: `${pad2(hour)}:00`,
          score,
        };
      }
    }
  }

  if (best && best.score > 0) {
    return best;
  }

  // Graceful fallback: tomorrow at 09:00
  return {
    dateStr: addCalendarDays(todayStr, 1),
    timeStr: "09:00",
    score: 85,
  };
}

/**
 * Generates deterministic B2B/creator audience heatmap curves when backend is offline.
 */
export function buildFallbackHeatmap(
  channel: string,
  tz: string
): BestTimeHeatmapResponse {
  const grid: BestTimeHeatmapResponse["grid"] = [];
  let peak = { day_label: "Mar", hour: 9, score: 94 };

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      let score = 22;
      if (channel === "LinkedIn") {
        if (d <= 4 && h >= 8 && h <= 10) score = d >= 1 && d <= 3 ? 94 : 84;
        else if (d <= 4 && h >= 12 && h <= 14) score = d >= 1 && d <= 3 ? 88 : 76;
        else if (d <= 4 && h >= 17 && h <= 19) score = 68;
        else if (d >= 5) score = 30;
      } else if (channel === "Instagram") {
        if (h >= 12 && h <= 14) score = 86;
        else if (h >= 19 && h <= 21) score = d >= 2 ? 93 : 88;
        else if (h >= 8 && h <= 11) score = 62;
      } else if (channel === "TikTok") {
        if (h >= 18 && h <= 22) score = d >= 3 ? 95 : 89;
        else if (h >= 12 && h <= 14) score = 74;
      } else {
        // YouTube
        if (d >= 3 && h >= 17 && h <= 21) score = 92;
        else if (h >= 15 && h <= 21) score = 79;
      }

      if (score > peak.score) {
        peak = { day_label: WEEKDAY_SHORT_ES[d], hour: h, score };
      }

      grid.push({
        day_of_week: d,
        day_label: WEEKDAY_SHORT_ES[d],
        hour: h,
        score,
        label: score >= 85 ? "Óptimo" : score >= 65 ? "Bueno" : "Bajo",
      });
    }
  }

  return {
    channel,
    timezone: normalizeTimeZone(tz),
    source: "benchmark",
    peak_slot: peak,
    grid,
  };
}

export function formatFriendlyDateEs(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const monthName = MONTH_NAMES_ES[m - 1] ?? "";
  return `${d} ${monthName.slice(0, 3).toLowerCase()} ${y}`;
}

export function shiftDateStr(dateStr: string, deltaDays: number): string {
  return addCalendarDays(dateStr, deltaDays);
}
