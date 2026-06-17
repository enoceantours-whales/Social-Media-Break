import { BRANDS, defaultScheduleTime } from "../../shared/brands.js";
import { PLATFORMS } from "../../shared/types.js";
import type {
  BrandId,
  CaptionSet,
  Platform,
  ScheduledPlatformResult,
  SchedulePostRequest,
} from "../../shared/types.js";

const BUFFER_API = "https://api.bufferapp.com/1";

/** Buffer's `service` strings map onto our Platform ids. */
const SERVICE_TO_PLATFORM: Record<string, Platform> = {
  instagram: "instagram",
  facebook: "facebook",
  twitter: "twitter",
  linkedin: "linkedin",
};

interface BufferProfile {
  id: string;
  service: string;
  service_username?: string;
  formatted_service?: string;
}

export interface ProfileSummary {
  id: string;
  service: string;
  platform: Platform | null;
  username: string;
}

/** GET /profiles — list the Buffer channels connected to this token. */
export async function listProfiles(token: string): Promise<ProfileSummary[]> {
  const res = await fetch(`${BUFFER_API}/profiles.json?access_token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    throw new Error(`Buffer profiles request failed (${res.status}): ${await res.text()}`);
  }
  const profiles = (await res.json()) as BufferProfile[];
  return profiles.map((p) => ({
    id: p.id,
    service: p.service,
    platform: SERVICE_TO_PLATFORM[p.service] ?? null,
    username: p.service_username ?? p.formatted_service ?? p.service,
  }));
}

/**
 * Parse a brand's pinned-profile env var, e.g.
 *   "instagram:5f...,facebook:5a..." -> { instagram: "5f...", facebook: "5a..." }
 */
function pinnedProfiles(brand: BrandId): Partial<Record<Platform, string>> {
  const raw =
    brand === "enocean"
      ? process.env.BUFFER_PROFILES_ENOCEAN
      : process.env.BUFFER_PROFILES_SMP;
  const out: Partial<Record<Platform, string>> = {};
  if (!raw) return out;
  for (const pair of raw.split(",")) {
    const [network, id] = pair.split(":").map((s) => s.trim());
    const platform = SERVICE_TO_PLATFORM[network ?? ""];
    if (platform && id) out[platform] = id;
  }
  return out;
}

/**
 * Resolve which Buffer profile to post to for each platform of a brand.
 * Prefers pinned env-var IDs, then falls back to the first connected profile
 * for that service.
 */
async function resolveProfiles(
  token: string,
  brand: BrandId,
): Promise<Partial<Record<Platform, string>>> {
  const pinned = pinnedProfiles(brand);
  const needed = PLATFORMS.filter((p) => !pinned[p]);
  if (needed.length === 0) return pinned;

  const all = await listProfiles(token);
  const resolved: Partial<Record<Platform, string>> = { ...pinned };
  for (const platform of needed) {
    const match = all.find((p) => p.platform === platform);
    if (match) resolved[platform] = match.id;
  }
  return resolved;
}

interface CreateUpdateResult {
  id: string | null;
  ok: boolean;
  message?: string;
}

/** POST /updates/create — schedule one update to one profile. */
async function createUpdate(
  token: string,
  profileId: string,
  text: string,
  scheduledAtIso: string,
  mediaUrl?: string,
): Promise<CreateUpdateResult> {
  const params = new URLSearchParams();
  params.set("access_token", token);
  params.append("profile_ids[]", profileId);
  params.set("text", text);
  params.set("scheduled_at", scheduledAtIso);
  if (mediaUrl) {
    params.set("media[photo]", mediaUrl);
    params.set("media[thumbnail]", mediaUrl);
  }

  const res = await fetch(`${BUFFER_API}/updates/create.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    updates?: { id: string }[];
    message?: string;
    code?: number;
  };
  if (!res.ok || data.success === false) {
    return { id: null, ok: false, message: data.message ?? `Buffer error ${res.status}` };
  }
  return { id: data.updates?.[0]?.id ?? null, ok: true };
}

function captionFor(captions: CaptionSet, platform: Platform): string {
  const c = captions[platform];
  if (!c) return "";
  const tags = c.hashtags?.length ? " " + c.hashtags.map((h) => `#${h}`).join(" ") : "";
  return `${c.text}${tags}`.trim();
}

/**
 * Schedule a post across all four platforms via Buffer. Falls back to a demo
 * (no real posts sent) when BUFFER_ACCESS_TOKEN is not configured.
 */
export async function schedulePost(req: SchedulePostRequest): Promise<{
  results: ScheduledPlatformResult[];
  dashboardUrl: string;
  demo: boolean;
}> {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  const scheduledAt = req.scheduledAt ?? defaultScheduleTime(req.brand).toISOString();
  const dashboardUrl = "https://publish.buffer.com/all-channels";

  if (!token) {
    return {
      demo: true,
      dashboardUrl,
      results: PLATFORMS.map((platform) => ({
        platform,
        profileId: null,
        bufferUpdateId: `demo-${platform}`,
        status: "scheduled" as const,
        message: "Demo mode — no Buffer token configured, nothing was actually sent.",
      })),
    };
  }

  const profiles = await resolveProfiles(token, req.brand);
  const results: ScheduledPlatformResult[] = [];

  for (const platform of PLATFORMS) {
    const profileId = profiles[platform] ?? null;
    if (!profileId) {
      results.push({
        platform,
        profileId: null,
        status: "skipped",
        bufferUpdateId: null,
        message: `No ${BRANDS[req.brand].name} ${platform} profile connected in Buffer.`,
      });
      continue;
    }
    const text = captionFor(req.captions, platform);
    try {
      const r = await createUpdate(token, profileId, text, scheduledAt, req.mediaUrl);
      results.push({
        platform,
        profileId,
        bufferUpdateId: r.id,
        status: r.ok ? "scheduled" : "error",
        message: r.ok ? undefined : r.message,
      });
    } catch (err) {
      results.push({
        platform,
        profileId,
        bufferUpdateId: null,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { results, dashboardUrl, demo: false };
}
