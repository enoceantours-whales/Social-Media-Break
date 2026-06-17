import type {
  ApiError,
  GenerateCaptionsRequest,
  GenerateCaptionsResponse,
  SchedulePostRequest,
  SchedulePostResponse,
} from "../../shared/types";

async function post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as TRes | ApiError;
  if (!res.ok) {
    const message = (data as ApiError).error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as TRes;
}

export function generateCaptions(
  req: GenerateCaptionsRequest,
): Promise<GenerateCaptionsResponse> {
  return post("/api/generate-captions", req);
}

export function schedulePost(req: SchedulePostRequest): Promise<SchedulePostResponse> {
  return post("/api/schedule-post", req);
}

/** Read a File into a base64 string (no data: prefix) + its MIME type. */
export function fileToBase64(
  file: File,
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve({ base64, mediaType: file.type });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Downscale an image in the browser to a small JPEG for Claude vision.
 *
 * Claude downsamples images anyway, so a ~1568px copy yields identical caption
 * quality while keeping the request well under the serverless body limit — full-
 * resolution media is still posted separately via Blob.
 */
export function downscaleImageToBase64(
  file: File,
  maxDim = 1568,
  quality = 0.85,
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas is not supported in this browser."));
        return;
      }
      // Flatten any transparency onto white so PNGs don't become black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? "";
      resolve({ base64, mediaType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}
