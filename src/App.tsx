import { useMemo, useState } from "react";
import { StepNav, type StepDef } from "./components/StepNav";
import { MediaUploader, type SelectedMedia } from "./components/MediaUploader";
import { BrandSelector, PostTypeSelector } from "./components/Selectors";
import { CaptionEditor } from "./components/CaptionEditor";
import { Scheduler } from "./components/Scheduler";
import { fileToBase64, generateCaptions, schedulePost, uploadMedia } from "./lib/api";
import { defaultScheduleTime } from "../shared/brands";
import { MAX_UPLOAD_BYTES } from "../shared/types";
import type {
  BrandId,
  CaptionSet,
  PostType,
  SchedulePostResponse,
} from "../shared/types";

const STEPS: StepDef[] = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Brand" },
  { id: 3, label: "Type" },
  { id: 4, label: "Captions" },
  { id: 5, label: "Schedule" },
];

export default function App() {
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [brand, setBrand] = useState<BrandId | null>(null);
  const [postType, setPostType] = useState<PostType | null>(null);
  const [context, setContext] = useState("");

  const [captions, setCaptions] = useState<CaptionSet | null>(null);
  const [captionsDemo, setCaptionsDemo] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [scheduledAt, setScheduledAt] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [result, setResult] = useState<SchedulePostResponse | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const currentStep = useMemo(() => {
    if (result) return 6;
    if (captions) return 5;
    if (postType) return 4;
    if (brand) return 3;
    if (media) return 2;
    return 1;
  }, [media, brand, postType, captions, result]);

  function chooseBrand(b: BrandId) {
    setBrand(b);
    // Reset the schedule to the new brand's default slot.
    setScheduledAt(defaultScheduleTime(b).toISOString());
  }

  async function handleGenerate() {
    if (!brand || !postType) return;
    setError(null);
    setGenerating(true);
    setResult(null);
    try {
      let imageBase64: string | undefined;
      let imageMediaType: string | undefined;
      if (media?.kind === "image") {
        const { base64, mediaType } = await fileToBase64(media.file);
        imageBase64 = base64;
        imageMediaType = mediaType;
      }
      const res = await generateCaptions({
        brand,
        postType,
        context: context.trim() || undefined,
        imageBase64,
        imageMediaType,
      });
      setCaptions(res.captions);
      setCaptionsDemo(res.demo);
      if (!scheduledAt) setScheduledAt(defaultScheduleTime(brand).toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caption generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSchedule() {
    if (!brand || !postType || !captions) return;
    setError(null);
    setNotice(null);
    setScheduling(true);
    try {
      let urlToUse = mediaUrl.trim();

      // Auto-host the uploaded file on Google Drive when no URL was pasted.
      if (!urlToUse && media) {
        if (media.file.size > MAX_UPLOAD_BYTES) {
          setNotice(
            `${media.file.name} is over ${MAX_UPLOAD_BYTES / 1024 / 1024} MB, so it wasn't auto-hosted — scheduling captions as text. Paste a hosted media URL to attach it.`,
          );
        } else {
          setUploadingMedia(true);
          try {
            const { base64, mediaType } = await fileToBase64(media.file);
            const up = await uploadMedia({ base64, mediaType, filename: media.file.name });
            if (up.url) {
              urlToUse = up.url;
              setMediaUrl(up.url);
            } else if (up.demo) {
              setNotice(
                "Google Drive isn't configured, so media wasn't hosted — scheduling captions as text. Set the GOOGLE_SERVICE_ACCOUNT_* env vars to auto-attach media.",
              );
            }
          } finally {
            setUploadingMedia(false);
          }
        }
      }

      const res = await schedulePost({
        brand,
        postType,
        captions,
        scheduledAt: scheduledAt || undefined,
        mediaUrl: urlToUse || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scheduling failed.");
    } finally {
      setScheduling(false);
    }
  }

  function startOver() {
    setMedia(null);
    setBrand(null);
    setPostType(null);
    setContext("");
    setCaptions(null);
    setCaptionsDemo(false);
    setScheduledAt("");
    setMediaUrl("");
    setResult(null);
    setError(null);
    setNotice(null);
  }

  const canGenerate = Boolean(brand && postType) && !generating;

  return (
    <div className="app">
      <header className="header">
        <h1>🌊 Social Media Break</h1>
        <p>Upload, generate captions with Claude, schedule everywhere — without opening a single app.</p>
      </header>

      <StepNav steps={STEPS} current={currentStep} />

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="demo-banner">{notice}</div>}

      {!result && (
        <>
          <MediaUploader media={media} onSelect={setMedia} />
          <BrandSelector value={brand} onChange={chooseBrand} />
          <PostTypeSelector value={postType} onChange={setPostType} />

          <div className="card">
            <h2>Add context (optional)</h2>
            <p className="hint">
              A line about what&apos;s in the post helps Claude — especially for videos it
              can&apos;t see. e.g. &quot;humpback breach off Dana Point, golden hour.&quot;
            </p>
            <textarea
              rows={2}
              placeholder="What's happening in this post?"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <div className="actions" style={{ marginTop: 16 }}>
              <span />
              <button className="btn primary" onClick={handleGenerate} disabled={!canGenerate}>
                {generating ? (
                  <>
                    <span className="spinner" />
                    Generating…
                  </>
                ) : captions ? (
                  "Regenerate captions"
                ) : (
                  "Generate captions ✨"
                )}
              </button>
            </div>
          </div>

          {captions && brand && (
            <>
              {captionsDemo && (
                <div className="demo-banner">
                  Demo captions — set <code>ANTHROPIC_API_KEY</code> to generate real ones with Claude.
                </div>
              )}
              <CaptionEditor captions={captions} onChange={setCaptions} />
              <Scheduler
                brand={brand}
                scheduledAt={scheduledAt || defaultScheduleTime(brand).toISOString()}
                onScheduledAtChange={setScheduledAt}
                mediaUrl={mediaUrl}
                onMediaUrlChange={setMediaUrl}
              />
              <div className="card">
                <div className="actions">
                  <button className="btn" onClick={startOver}>
                    Start over
                  </button>
                  <button className="btn primary" onClick={handleSchedule} disabled={scheduling}>
                    {scheduling ? (
                      <>
                        <span className="spinner" />
                        {uploadingMedia ? "Hosting media…" : "Scheduling…"}
                      </>
                    ) : (
                      "Schedule via Buffer →"
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {result && (
        <div className="card">
          <h2>✅ Scheduled</h2>
          {result.demo && (
            <div className="demo-banner" style={{ marginBottom: 14 }}>
              Demo mode — set <code>BUFFER_ACCESS_TOKEN</code> to send real posts. Nothing was published.
            </div>
          )}
          <p className="hint">Here&apos;s how each platform landed:</p>
          {result.results.map((r) => (
            <div className="result-row" key={r.platform}>
              <span style={{ textTransform: "capitalize" }}>{r.platform}</span>
              <span className={`status-dot ${r.status}`}>
                {r.status === "scheduled" ? "✓ scheduled" : r.status === "skipped" ? "— skipped" : "✕ error"}
                {r.message ? ` · ${r.message}` : ""}
              </span>
            </div>
          ))}
          <div className="actions" style={{ marginTop: 16 }}>
            <a className="btn" href={result.dashboardUrl} target="_blank" rel="noreferrer">
              Open Buffer dashboard ↗
            </a>
            <button className="btn primary" onClick={startOver}>
              Create another post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
