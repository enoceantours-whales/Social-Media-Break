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
}

export function CaptionEditor({ captions, onChange }: Props) {
  function update(platform: Platform, patch: Partial<CaptionSet[Platform]>) {
    onChange({ ...captions, [platform]: { ...captions[platform], ...patch } });
  }

  return (
    <div className="card">
      <h2>4 · Review &amp; edit captions</h2>
      <p className="hint">Claude tuned each one to the platform and brand voice. Edit freely before scheduling.</p>

      {PLATFORMS.map((platform) => {
        const c = captions[platform];
        const meta = PLATFORM_META[platform];
        const length = renderedLength(c.text, c.hashtags);
        const over = meta.limit != null && length > meta.limit;
        return (
          <div className="caption" key={platform}>
            <div className="caption-head">
              <span className="platform-tag">
                <span aria-hidden>{meta.icon}</span>
                {meta.label}
              </span>
              <span className={`char-count ${over ? "over" : ""}`}>
                {length} chars · {meta.target}
              </span>
            </div>
            <textarea
              rows={3}
              value={c.text}
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
