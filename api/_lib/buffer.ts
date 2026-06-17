import { BRANDS, defaultScheduleTime } from "../../shared/brands.js";
import { PLATFORMS } from "../../shared/types.js";
import type {
  BrandId,
  CaptionSet,
  Platform,
  ScheduledPlatformResult,
  SchedulePostRequest,
} from "../../shared/types.js";

// Buffer's current API is GraphQL. The legacy api.bufferapp.com REST API does
// not accept the new personal/app keys (it 401s with an OIDC error).
const BUFFER_GRAPHQL = "https://api.buffer.com";

/** Buffer `service` strings map onto our Platform ids. */
const SERVICE_TO_PLATFORM: Record<string, Platform> = {
  instagram: "instagram",
  facebook: "facebook",
  twitter: "twitter",
  x: "twitter",
  linkedin: "linkedin",
};

interface BufferChannel {
  id: string;
  name?: string;
  displayName?: string;
  service: string;
  organizationId: string;
  organizationName: string;
}

export interface ProfileSummary {
  id: string;
  service: string;
  platform: Platform | null;
  username: string;
}

/** Run a GraphQL operation against the Buffer API with a Bearer token. */
async function bufferGraphQL<T>(
  token: string,
  query: string,
): Promise<T> {
  const res = await fetch(BUFFER_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (!res.ok) {
    const detail = json.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`Buffer API request failed: ${detail}`);
  }
  if (json.errors?.length) {
    throw new Error(`Buffer API error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Buffer API returned no data.");
  return json.data;
}

/** List every channel across the token's organizations. */
async function fetchChannels(token: string): Promise<BufferChannel[]> {
  const orgData = await bufferGraphQL<{
    account: { organizations: { id: string; name: string }[] };
  }>(token, `query { account { organizations { id name } } }`);

  const channels: BufferChannel[] = [];
  for (const org of orgData.account.organizations ?? []) {
    const data = await bufferGraphQL<{
      channels: { id: string; name?: string; displayName?: string; service: string }[];
    }>(
      token,
      `query { channels(input: { organizationId: ${JSON.stringify(org.id)} }) {
        id
        name
        displayName
        service
      } }`,
    );
    for (const c of data.channels ?? []) {
      channels.push({ ...c, organizationId: org.id, organizationName: org.name });
    }
  }
  return channels;
}

/** GET /api/profiles — list the Buffer channels connected to this token. */
export async function listProfiles(token: string): Promise<ProfileSummary[]> {
  const channels = await fetchChannels(token);
  return channels.map((c) => ({
    id: c.id,
    service: c.service,
    platform: SERVICE_TO_PLATFORM[c.service] ?? null,
    username: c.displayName ?? c.name ?? c.service,
  }));
}

/**
 * Parse a brand's pinned-channel env var, e.g.
 *   "instagram:5f...,facebook:5a..." -> { instagram: "5f...", facebook: "5a..." }
 */
function pinnedChannels(brand: BrandId): Partial<Record<Platform, string>> {
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
 * Resolve which Buffer channel to post to for each platform of a brand.
 * Prefers pinned env-var IDs; otherwise matches by service, preferring a
 * channel whose name mentions the brand, then falling back to the first match.
 */
function resolveChannels(
  channels: BufferChannel[],
  brand: BrandId,
): Partial<Record<Platform, string>> {
  const pinned = pinnedChannels(brand);
  const resolved: Partial<Record<Platform, string>> = { ...pinned };
  const brandName = BRANDS[brand].name.toLowerCase();
  const brandKey = brand === "enocean" ? "enocean" : "moore";

  for (const platform of PLATFORMS) {
    if (resolved[platform]) continue;
    const matches = channels.filter((c) => SERVICE_TO_PLATFORM[c.service] === platform);
    if (matches.length === 0) continue;
    const branded = matches.find((c) => {
      const label = `${c.displayName ?? ""} ${c.name ?? ""} ${c.organizationName}`.toLowerCase();
      return label.includes(brandName) || label.includes(brandKey);
    });
    resolved[platform] = (branded ?? matches[0]).id;
  }
  return resolved;
}

function captionFor(captions: CaptionSet, platform: Platform): string {
  const c = captions[platform];
  if (!c) return "";
  const tags = c.hashtags?.length ? " " + c.hashtags.map((h) => `#${h}`).join(" ") : "";
  return `${c.text}${tags}`.trim();
}

interface CreatePostResult {
  id: string | null;
  ok: boolean;
  message?: string;
}

/** Build a Buffer AssetInput for a hosted media URL (image vs video by extension). */
function assetForUrl(url: string): string {
  const isVideo = /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(url);
  const inner = `{ url: ${JSON.stringify(url)} }`;
  return isVideo ? `{ video: ${inner} }` : `{ image: ${inner} }`;
}

/** createPost mutation — schedule one post to one channel at an exact time. */
async function createPost(
  token: string,
  channelId: string,
  text: string,
  dueAtIso: string,
  mediaUrl?: string,
): Promise<CreatePostResult> {
  const fields = [
    `channelId: ${JSON.stringify(channelId)}`,
    `text: ${JSON.stringify(text)}`,
    `schedulingType: automatic`,
    `mode: customScheduled`,
    `dueAt: ${JSON.stringify(dueAtIso)}`,
  ];
  // Media attaches through the assets array ([AssetInput!] with @oneOf image/video).
  if (mediaUrl) fields.push(`assets: [${assetForUrl(mediaUrl)}]`);

  try {
    // createPost returns a PostActionPayload union (PostActionSuccess | MutationError),
    // so select fields via inline fragments and surface any rejection message.
    const data = await bufferGraphQL<{
      createPost: { __typename: string; post?: { id: string }; message?: string };
    }>(
      token,
      `mutation { createPost(input: { ${fields.join(", ")} }) {
        __typename
        ... on PostActionSuccess { post { id } }
        ... on MutationError { message }
      } }`,
    );
    const cp = data.createPost;
    // Only PostActionSuccess carries a post. Every error type (LimitReachedError,
    // etc.) implements the MutationError interface, so the `message` fragment is
    // populated regardless of the concrete type — treat "no post" as an error and
    // surface why (matching on __typename === "MutationError" never works, since
    // the real typename is the concrete error type).
    if (cp?.post?.id) {
      return { id: cp.post.id, ok: true };
    }
    return {
      id: null,
      ok: false,
      message:
        cp?.message ??
        `Buffer could not create the post (${cp?.__typename ?? "unknown response"}).`,
    };
  } catch (err) {
    return { id: null, ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Schedule a post across the selected platforms via Buffer's GraphQL API.
 * Falls back to a demo (no real posts sent) when BUFFER_ACCESS_TOKEN is unset.
 */
export async function schedulePost(req: SchedulePostRequest): Promise<{
  results: ScheduledPlatformResult[];
  dashboardUrl: string;
  demo: boolean;
}> {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  const scheduledAt = req.scheduledAt ?? defaultScheduleTime(req.brand).toISOString();
  const dashboardUrl = "https://publish.buffer.com/all-channels";
  const selected = req.platforms?.length ? req.platforms : PLATFORMS;

  if (!token) {
    return {
      demo: true,
      dashboardUrl,
      results: selected.map((platform) => ({
        platform,
        profileId: null,
        bufferUpdateId: `demo-${platform}`,
        status: "scheduled" as const,
        message: "Demo mode — no Buffer token configured, nothing was actually sent.",
      })),
    };
  }

  const channels = await fetchChannels(token);
  const resolved = resolveChannels(channels, req.brand);
  const labelById = new Map(
    channels.map((c) => [c.id, c.displayName ?? c.name ?? c.service]),
  );
  const results: ScheduledPlatformResult[] = [];

  for (const platform of selected) {
    const channelId = resolved[platform] ?? null;
    if (!channelId) {
      results.push({
        platform,
        profileId: null,
        status: "skipped",
        bufferUpdateId: null,
        message: `No ${BRANDS[req.brand].name} ${platform} channel connected in Buffer.`,
      });
      continue;
    }
    const text = captionFor(req.captions, platform);
    const r = await createPost(token, channelId, text, scheduledAt, req.mediaUrl);
    const label = labelById.get(channelId) ?? channelId;
    results.push({
      platform,
      profileId: channelId,
      bufferUpdateId: r.id,
      status: r.ok ? "scheduled" : "error",
      message: r.ok ? `→ ${label} · post ${r.id}` : r.message,
    });
  }

  return { results, dashboardUrl, demo: false };
}
