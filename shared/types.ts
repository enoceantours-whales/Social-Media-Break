// Shared type definitions used by both the React frontend and the API functions.

export type BrandId = "enocean" | "smp";

export type PostType = "photo" | "carousel" | "reel" | "story";

export type Platform = "instagram" | "facebook" | "twitter" | "linkedin";

export const PLATFORMS: Platform[] = [
  "instagram",
  "facebook",
  "twitter",
  "linkedin",
];

export const POST_TYPES: PostType[] = ["photo", "carousel", "reel", "story"];

/** A single platform's caption, plus any hashtags broken out for editing. */
export interface PlatformCaption {
  text: string;
  hashtags: string[];
}

/** Captions keyed by platform — the shape Claude returns and the UI edits.
 *  Only the requested platforms are present, so entries are optional. */
export type CaptionSet = Partial<Record<Platform, PlatformCaption>>;

export interface GenerateCaptionsRequest {
  brand: BrandId;
  postType: PostType;
  /** Which platforms to write captions for. Omit to write for all four. */
  platforms?: Platform[];
  /** Optional free-text context from the user ("humpback breach off Dana Pt"). */
  context?: string;
  /** Optional base64-encoded image (no data: prefix) for vision on photo posts. */
  imageBase64?: string;
  /** MIME type of the image, e.g. "image/jpeg". Required if imageBase64 is set. */
  imageMediaType?: string;
}

export interface GenerateCaptionsResponse {
  captions: CaptionSet;
  /** True when no ANTHROPIC_API_KEY is configured and sample captions were returned. */
  demo: boolean;
}

export interface SchedulePostRequest {
  brand: BrandId;
  postType: PostType;
  captions: CaptionSet;
  /** Which platforms to actually post to. Omit to post to all four. */
  platforms?: Platform[];
  /** ISO 8601 timestamp for when to publish. Omit to use the brand default. */
  scheduledAt?: string;
  /** Publicly reachable URL of the media to attach (Buffer requires a hosted URL). */
  mediaUrl?: string;
}

export interface ScheduledPlatformResult {
  platform: Platform;
  profileId: string | null;
  bufferUpdateId: string | null;
  status: "scheduled" | "skipped" | "error";
  message?: string;
}

export interface SchedulePostResponse {
  results: ScheduledPlatformResult[];
  dashboardUrl: string;
  demo: boolean;
}

export interface ApiError {
  error: string;
}
