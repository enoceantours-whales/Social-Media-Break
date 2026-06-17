import { BRANDS, POST_TYPE_HINTS, POST_TYPE_LABELS } from "../../shared/brands";
import { POST_TYPES, PLATFORMS } from "../../shared/types";
import type { BrandId, Platform, PostType } from "../../shared/types";

const PLATFORM_INFO: Record<Platform, { label: string; icon: string }> = {
  instagram: { label: "Instagram", icon: "📸" },
  facebook: { label: "Facebook", icon: "👥" },
  twitter: { label: "Twitter / X", icon: "🐦" },
  linkedin: { label: "LinkedIn", icon: "💼" },
};

interface BrandProps {
  value: BrandId | null;
  onChange: (brand: BrandId) => void;
}

export function BrandSelector({ value, onChange }: BrandProps) {
  return (
    <div className="card">
      <h2>2 · Select brand account</h2>
      <p className="hint">Which account is this post for?</p>
      <div className="option-grid">
        {(Object.values(BRANDS)).map((b) => (
          <button
            key={b.id}
            type="button"
            className={`option ${value === b.id ? "selected" : ""}`}
            onClick={() => onChange(b.id)}
          >
            <div className="title">{b.name}</div>
            <div className="sub">{b.tagline}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface PlatformProps {
  value: Platform[];
  onChange: (platforms: Platform[]) => void;
}

export function PlatformSelector({ value, onChange }: PlatformProps) {
  function toggle(p: Platform) {
    // Keep a stable platform order regardless of click sequence.
    onChange(
      value.includes(p)
        ? value.filter((x) => x !== p)
        : PLATFORMS.filter((x) => x === p || value.includes(x)),
    );
  }
  return (
    <div className="card">
      <h2>Platforms</h2>
      <p className="hint">
        Captions are written — and posted — only for the platforms you pick here.
      </p>
      <div className="option-grid">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            className={`option ${value.includes(p) ? "selected" : ""}`}
            onClick={() => toggle(p)}
          >
            <div className="title">
              <span aria-hidden>{PLATFORM_INFO[p].icon}</span> {PLATFORM_INFO[p].label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface PostTypeProps {
  value: PostType | null;
  onChange: (type: PostType) => void;
}

export function PostTypeSelector({ value, onChange }: PostTypeProps) {
  return (
    <div className="card">
      <h2>3 · Select post type</h2>
      <p className="hint">How should this go out?</p>
      <div className="option-grid">
        {POST_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`option ${value === t ? "selected" : ""}`}
            onClick={() => onChange(t)}
          >
            <div className="title">{POST_TYPE_LABELS[t]}</div>
            <div className="sub">{POST_TYPE_HINTS[t]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
