import type { BrandId, PostType } from "./types";

export interface BrandConfig {
  id: BrandId;
  name: string;
  tagline: string;
  /** Voice guidance fed to Claude when generating captions. */
  voice: string;
  /** Default posting schedule, expressed in the brand's local time (PT). */
  schedule: {
    /** 24h hour for weekday posts. */
    weekdayHour: number;
    /** 24h hour for weekend posts. */
    weekendHour: number;
  };
  /** Supported post types for this brand (all brands support the MVP set). */
  postTypes: PostType[];
}

export const BRANDS: Record<BrandId, BrandConfig> = {
  enocean: {
    id: "enocean",
    name: "Enocean Tours",
    tagline: "Whale watching · nautical · professional-casual",
    voice: [
      "Direct, authentic, grounded in local knowledge.",
      '"Here\'s what we saw today" energy — first-hand, in the moment.',
      "Professional but casual and warm; never corporate or salesy.",
      "Celebrates the ocean, marine life, and the people on board.",
      "Sounds like an experienced captain who genuinely loves the work.",
    ].join(" "),
    schedule: { weekdayHour: 9, weekendHour: 10 },
    postTypes: ["photo", "carousel", "reel", "story"],
  },
  smp: {
    id: "smp",
    name: "Slater Moore Photography",
    tagline: "Cinematic · understated · artistic",
    voice: [
      "Cinematic and understated; let the image do the talking.",
      "Focus on light, the moment, and craft — not promotion.",
      "Spare, intentional language. Often a single evocative line.",
      "Artistic and quietly confident; never over-explains.",
      "Reads like a photographer's private caption, not an ad.",
    ].join(" "),
    schedule: { weekdayHour: 18, weekendHour: 18 },
    postTypes: ["photo", "carousel", "reel", "story"],
  },
};

export const POST_TYPE_LABELS: Record<PostType, string> = {
  photo: "Photo",
  carousel: "Carousel",
  reel: "Reel",
  story: "Story",
};

export const POST_TYPE_HINTS: Record<PostType, string> = {
  photo: "Single static image",
  carousel: "Multiple images (2–5)",
  reel: "Video, 30 sec – 3 min",
  story: "Ephemeral, auto-formats to 1080×1920",
};

/**
 * Compute the brand's default next posting time as an ISO string.
 * Picks today's slot if it's still in the future, otherwise tomorrow's.
 * Times are interpreted as Pacific Time per the brand spec.
 */
export function defaultScheduleTime(brand: BrandId, now: Date = new Date()): Date {
  const cfg = BRANDS[brand];

  // Work in Pacific time. We approximate by formatting "now" into PT parts.
  const ptParts = ptDateParts(now);
  const candidate = new Date(now.getTime());

  const isWeekend = ptParts.weekday === 0 || ptParts.weekday === 6;
  const targetHour = isWeekend ? cfg.schedule.weekendHour : cfg.schedule.weekdayHour;

  // Build a PT timestamp for today at targetHour, then convert back to UTC.
  let target = ptTimeToUtc(ptParts.year, ptParts.month, ptParts.day, targetHour);

  // If today's slot already passed, roll to tomorrow and recompute weekday slot.
  if (target.getTime() <= candidate.getTime()) {
    const tomorrow = new Date(target.getTime() + 24 * 60 * 60 * 1000);
    const tp = ptDateParts(tomorrow);
    const weekendTomorrow = tp.weekday === 0 || tp.weekday === 6;
    const hour = weekendTomorrow ? cfg.schedule.weekendHour : cfg.schedule.weekdayHour;
    target = ptTimeToUtc(tp.year, tp.month, tp.day, hour);
  }

  return target;
}

interface PtParts {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // 0 = Sunday
}

function ptDateParts(date: Date): PtParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

/**
 * Convert a Pacific-Time wall-clock (Y/M/D + hour) into a UTC Date, accounting
 * for the current PT offset (PST -08:00 / PDT -07:00).
 */
function ptTimeToUtc(year: number, month: number, day: number, hour: number): Date {
  // Start from a UTC guess at the same wall-clock, then correct by the offset
  // that PT actually has at that instant.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  const offsetMinutes = ptOffsetMinutes(guess);
  return new Date(guess.getTime() - offsetMinutes * 60 * 1000);
}

/** Returns the PT UTC-offset in minutes for the given instant (e.g. -480 for PST). */
function ptOffsetMinutes(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
  });
  const tzName = fmt.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "GMT-8";
  const match = tzName.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) return -480;
  const hours = Number(match[1]);
  const mins = Number(match[2] ?? "0");
  return hours * 60 + (hours < 0 ? -mins : mins);
}
