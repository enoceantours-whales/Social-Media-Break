import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { applyCors, parseBody, sendError } from "./_lib/http.js";

// Content types we let the browser upload directly to Blob storage.
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

// Generous ceiling so 40 MB+ photos and videos go through; the file never
// passes through this function — the browser uploads straight to Blob.
const MAX_BYTES = 500 * 1024 * 1024;

/**
 * Mints short-lived client tokens so the browser can upload media directly to
 * Vercel Blob (bypassing the ~4.5 MB serverless body limit). Returns the
 * public URL via the client `upload()` call, not this endpoint.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return sendError(res, 405, "Use POST.");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return sendError(
      res,
      503,
      "Media hosting isn't configured. Add a Vercel Blob store (BLOB_READ_WRITE_TOKEN) to attach media.",
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body: parseBody<HandleUploadBody>(req),
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      }),
      // The client receives the public URL directly from upload(); nothing to do here.
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload authorization failed.";
    return sendError(res, 400, message);
  }
}
