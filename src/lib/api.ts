import type {
  ApiError,
  GenerateCaptionsRequest,
  GenerateCaptionsResponse,
  SchedulePostRequest,
  SchedulePostResponse,
  UploadMediaRequest,
  UploadMediaResponse,
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

export function uploadMedia(req: UploadMediaRequest): Promise<UploadMediaResponse> {
  return post("/api/upload-media", req);
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
