import { useRef, useState } from "react";

export interface SelectedMedia {
  file: File;
  url: string;
  kind: "image" | "video";
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");

interface Props {
  media: SelectedMedia | null;
  onSelect: (media: SelectedMedia | null) => void;
}

export function MediaUploader({ media, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    setError(null);
    const file = files?.[0];
    if (!file) return;
    const isImage = IMAGE_TYPES.includes(file.type);
    const isVideo = VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      setError("Unsupported format. Use JPG, PNG, WebP, MP4, MOV, or WebM.");
      return;
    }
    onSelect({
      file,
      url: URL.createObjectURL(file),
      kind: isImage ? "image" : "video",
    });
  }

  return (
    <div className="card">
      <h2>1 · Upload media</h2>
      <p className="hint">Drag &amp; drop or pick a video or photo. JPG, PNG, WebP, MP4, MOV, WebM.</p>

      <div
        className={`dropzone ${dragging ? "drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <strong>{media ? "Choose a different file" : "Drop your file here"}</strong>
        <span>or click to browse</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <div className="banner error" style={{ marginTop: 14 }}>{error}</div>}

      {media && (
        <div className="preview">
          {media.kind === "image" ? (
            <img src={media.url} alt="Upload preview" />
          ) : (
            <video src={media.url} controls />
          )}
          <div className="meta">
            <div>{media.file.name}</div>
            <div>{(media.file.size / 1024 / 1024).toFixed(1)} MB</div>
            <div>{media.kind === "image" ? "Photo" : "Video"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
