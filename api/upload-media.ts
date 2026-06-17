import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, parseBody, sendError } from "./_lib/http.js";
import { uploadToDrive } from "./_lib/drive.js";
import { MAX_UPLOAD_BYTES } from "../shared/types.js";
import type { UploadMediaRequest } from "../shared/types.js";

export const config = {
  // Allow a larger body than the default for base64 media payloads.
  api: { bodyParser: { sizeLimit: "5mb" } },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return sendError(res, 405, "Use POST.");

  const body = parseBody<UploadMediaRequest>(req);
  if (!body.base64 || !body.mediaType || !body.filename) {
    return sendError(res, 400, "`base64`, `mediaType`, and `filename` are all required.");
  }

  // Guard the serverless body limit (base64 inflates the original ~33%).
  const approxBytes = Math.floor((body.base64.length * 3) / 4);
  if (approxBytes > MAX_UPLOAD_BYTES) {
    return sendError(
      res,
      413,
      `File is too large to host through this endpoint (~${(approxBytes / 1024 / 1024).toFixed(
        1,
      )} MB). Keep media under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or paste a hosted URL instead.`,
    );
  }

  try {
    const result = await uploadToDrive(body.base64, body.filename, body.mediaType);
    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Media upload failed.";
    return sendError(res, 502, message);
  }
}
