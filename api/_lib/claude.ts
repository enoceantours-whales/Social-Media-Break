import Anthropic from "@anthropic-ai/sdk";
import { BRANDS, POST_TYPE_LABELS } from "../../shared/brands.js";
import { PLATFORMS } from "../../shared/types.js";
import type {
  BrandId,
  CaptionSet,
  GenerateCaptionsRequest,
  Platform,
  PlatformCaption,
} from "../../shared/types.js";

// Default to the latest, most capable Claude model. See the claude-api skill.
const MODEL = "claude-opus-4-8";

/** Per-platform format rules baked into the prompt. */
const PLATFORM_RULES: Record<Platform, string> = {
  instagram:
    "Instagram: conversational, 120–200 characters of body copy, emoji used sparingly (0–2). Provide 5–10 relevant hashtags in the hashtags array (without the # so the UI can render them).",
  facebook:
    "Facebook: longer form, 150–300 characters, platform-native voice with a soft call-to-action (e.g. book a trip, see more, tag a friend). 0–3 hashtags.",
  twitter:
    "Twitter/X: punchy and link-friendly, the full text MUST stay under 280 characters including hashtags. 1–3 hashtags.",
  linkedin:
    "LinkedIn: professional with a light thought-leadership angle, 200–400 characters. 0–3 hashtags, professional in tone.",
};

/** JSON schema constraining Claude's output to a clean, parseable caption set. */
function captionSchema(platforms: Platform[]) {
  const platformObject = {
    type: "object",
    properties: {
      text: { type: "string" },
      hashtags: { type: "array", items: { type: "string" } },
    },
    required: ["text", "hashtags"],
    additionalProperties: false,
  };
  return {
    type: "object",
    properties: Object.fromEntries(platforms.map((p) => [p, platformObject])),
    required: [...platforms],
    additionalProperties: false,
  };
}

function buildPrompt(brand: BrandId, req: GenerateCaptionsRequest, platforms: Platform[]): string {
  const cfg = BRANDS[brand];
  const rules = platforms.map((p) => `- ${PLATFORM_RULES[p]}`).join("\n");
  const contextLine = req.context?.trim()
    ? `\nWhat's in this post (from the photographer/operator): "${req.context.trim()}"`
    : "";
  const imageLine = req.imageBase64
    ? "\nAn image is attached — look at it and write captions that reflect what's actually shown."
    : "";

  return [
    `You write social captions for ${cfg.name} (${cfg.tagline}).`,
    "",
    "Brand voice:",
    cfg.voice,
    "",
    `Post type: ${POST_TYPE_LABELS[req.postType]}.`,
    contextLine,
    imageLine,
    "",
    "Write one caption for each of the requested platforms, each tuned to that platform AND staying true to the brand voice. Do not be robotic or generic. Per-platform rules:",
    rules,
    "",
    "Return hashtags without the leading # character. Keep them genuinely relevant — quality over quantity.",
  ].join("\n");
}

/** Sample captions used when no API key is set, so the UI is fully clickable. */
export function demoCaptions(brand: BrandId, platforms: Platform[] = [...PLATFORMS]): CaptionSet {
  const enocean = brand === "enocean";
  const mk = (text: string, hashtags: string[]): PlatformCaption => ({ text, hashtags });
  const full: Record<Platform, PlatformCaption> = enocean
    ? {
      instagram: mk(
        "Glassy seas and a curious gray whale that stuck with us most of the morning. Days like this are why we do it. 🐋",
        ["whalewatching", "danapoint", "enoceantours", "pacificocean", "graywhale"],
      ),
      facebook: mk(
        "Today's trip delivered — calm water, great light, and a gray whale that surfaced alongside us for nearly twenty minutes. There's nothing like watching it happen in person. Come see what's out there with us this week.",
        ["whalewatching", "danapoint"],
      ),
      twitter: mk(
        "Calm seas, great light, and a gray whale that hung around all morning. This is the job. 🐋",
        ["whalewatching", "danapoint"],
      ),
      linkedin: mk(
        "Every trip is a reminder that the Pacific runs on its own schedule. This morning it rewarded a patient crew with a gray whale alongside the boat for twenty minutes. Sharing the ocean with first-time guests never gets old.",
        ["marinelife", "ecotourism"],
      ),
    }
    : {
      instagram: mk("Last light, holding on a little longer than it should have.", [
        "cinematography",
        "naturallight",
        "slatermoore",
      ]),
      facebook: mk(
        "A frame from this week — that narrow window when the light goes soft and everything quiets down. Worth waiting for.",
        ["photography"],
      ),
      twitter: mk("That last bit of light, holding.", ["photography", "cinematography"]),
      linkedin: mk(
        "Most of the work is waiting — for the light, the moment, the stillness. This frame came at the very end of the day, when both finally arrived.",
        ["photography", "visualstorytelling"],
      ),
    };
  // Only return the requested platforms.
  return Object.fromEntries(platforms.map((p) => [p, full[p]])) as CaptionSet;
}

/**
 * Generate platform-specific captions with Claude. Falls back to demo captions
 * when ANTHROPIC_API_KEY is not configured so the app remains usable.
 */
export async function generateCaptions(
  req: GenerateCaptionsRequest,
): Promise<{ captions: CaptionSet; demo: boolean }> {
  const platforms = req.platforms?.length ? req.platforms : [...PLATFORMS];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { captions: demoCaptions(req.brand, platforms), demo: true };
  }

  const client = new Anthropic({ apiKey });

  const content: Anthropic.ContentBlockParam[] = [];
  if (req.imageBase64 && req.imageMediaType) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: req.imageMediaType as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp",
        data: req.imageBase64,
      },
    });
  }
  content.push({ type: "text", text: buildPrompt(req.brand, req, platforms) });

  // `thinking: adaptive` and `output_config` are current API features that the
  // pinned SDK's TS types predate, so we build the body and cast it through.
  const body = {
    model: MODEL,
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    output_config: {
      format: { type: "json_schema", schema: captionSchema(platforms) },
    },
    messages: [{ role: "user", content }],
  };

  const response = await client.messages.create(
    body as unknown as Anthropic.MessageCreateParamsNonStreaming,
  );

  // With output_config.format the first text block is guaranteed valid JSON.
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no caption text.");
  }
  const parsed = JSON.parse(textBlock.text) as CaptionSet;
  return { captions: parsed, demo: false };
}
