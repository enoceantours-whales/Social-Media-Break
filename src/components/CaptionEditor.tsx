import { PLATFORMS } from "../../shared/types";
import type { CaptionSet, Platform } from "../../shared/types";

const PLATFORM_META: Record<Platform, { label: string; icon: string; limit?: number; target: string }> = {
  instagram: { label: "Instagram", icon: "📸", target: "120–200 chars" },
  facebook: { label: "Facebook", icon: "👥", target: "150–300 chars" },
  twitter: { label: "Twitter / X", icon: "🐦", limit: 280, target: "under 280" },
  linkedin: { label: "LinkedIn", icon: "💼", target: "200–400 chars" },
};

/** Full rendered length including hashtags, the way it posts. */
function renderedLength(text: string, hashtags: string[]): number {
  const tags = hashtags.length ? " " + hashtags.map((h) => `#${h}`).join(" ") : "";
  return (text + tags).length;
}

interface Props {
  captions: CaptionSet;
  onChange: (captions: CaptionSet) => void;
  /** Platforms that will actually be posted to. */
  selected: Platform[];
  onToggle: (platform: Platform, included: boolean) => void;
}

export function CaptionEditor({ captions, onChange, selected, onToggle }: Props) {
  function update(platform: Platform, patch: Partial<CaptionSet[Platform]>) {
    onChange({ ...captions, [platform]: { ...captions[platform], ...patch } });
  }

  return (
    <div className="card">
      <h2>4 · Review &amp; edit captions</h2>
      <p className="hint">
        Claude tuned each one to the platform and brand voice. Edit freely, and untick any
        platform you don&apos;t want to post to — only ticked ones are scheduled.
      </p>

      {PLATFORMS.map((platform) => {
        const c = captions[platform];
        const meta = PLATFORM_META[platform];
        const length = renderedLength(c.text, c.hashtags);
        const over = meta.limit != null && length > meta.limit;
        const included = selected.includes(platform);
        return (
          <div
            className="caption"
            key={platform}
            style={{ opacity: included ? 1 : 0.5 }}
          >
            <div className="caption-head">
              <label
                className="platform-tag"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={included}
                  onChange={(e) => onToggle(platform, e.target.checked)}
                />
                <span aria-hidden>{meta.icon}</span>
                {meta.label}
              </label>
              <span className={`char-count ${over ? "over" : ""}`}>
                {included ? `${length} chars · ${meta.target}` : "won't post"}
              </span>
            </div>
            <textarea
              rows={3}
              value={c.text}
              disabled={!included}
              onChange={(e) => update(platform, { text: e.target.value })}
            />
            <div className="hashtags">
              <label className="field" htmlFor={`tags-${platform}`}>
                Hashtags (comma or space separated, no #)
              </label>
              <input
                id={`tags-${platform}`}
                type="text"
                value={c.hashtags.join(" ")}
                disabled={!included}
                onChange={(e) =>
                  update(platform, {
                    hashtags: e.target.value
                      .split(/[\s,]+/)
                      .map((t) => t.replace(/^#/, "").trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
