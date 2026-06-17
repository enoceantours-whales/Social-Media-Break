import { BRANDS } from "../../shared/brands";
import type { BrandId } from "../../shared/types";

/** ISO string -> value for <input type="datetime-local"> (local wall clock). */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> ISO string. */
function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

interface Props {
  brand: BrandId;
  scheduledAt: string;
  onScheduledAtChange: (iso: string) => void;
  mediaUrl: string;
  onMediaUrlChange: (url: string) => void;
}

export function Scheduler({
  brand,
  scheduledAt,
  onScheduledAtChange,
  mediaUrl,
  onMediaUrlChange,
}: Props) {
  const cfg = BRANDS[brand];
  const when = new Date(scheduledAt);
  const friendly = when.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="card">
      <h2>5 · Schedule &amp; post</h2>
      <p className="hint">
        Defaulting to {cfg.name}&apos;s usual slot — weekdays{" "}
        {cfg.schedule.weekdayHour}:00, weekends {cfg.schedule.weekendHour}:00 PT. Adjust if you like.
      </p>

      <div className="row">
        <div>
          <label className="field" htmlFor="when">
            Posting time
          </label>
          <input
            id="when"
            type="datetime-local"
            value={isoToLocalInput(scheduledAt)}
            onChange={(e) => {
              if (e.target.value) onScheduledAtChange(localInputToIso(e.target.value));
            }}
          />
        </div>
        <div>
          <label className="field" htmlFor="media-url">
            Media URL (optional — overrides the auto-upload)
          </label>
          <input
            id="media-url"
            type="text"
            placeholder="https://…"
            value={mediaUrl}
            onChange={(e) => onMediaUrlChange(e.target.value)}
          />
        </div>
      </div>

      <p className="hint" style={{ marginTop: 14, marginBottom: 0 }}>
        Will be sent to Buffer for <strong>{friendly}</strong>. Your uploaded photo/video is
        uploaded to Vercel Blob on schedule (large files included) and attached automatically —
        or paste your own hosted URL above to override.
      </p>
    </div>
  );
}
