import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, parseBody, sendError } from "./_lib/http.js";
import { generateCaptions } from "./_lib/claude.js";
import { BRANDS } from "../shared/brands.js";
import { POST_TYPES } from "../shared/types.js";
import type { GenerateCaptionsRequest } from "../shared/types.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return sendError(res, 405, "Use POST.");

  const body = parseBody<GenerateCaptionsRequest>(req);

  if (!body.brand || !BRANDS[body.brand]) {
    return sendError(res, 400, "A valid `brand` is required (enocean | smp).");
  }
  if (!body.postType || !POST_TYPES.includes(body.postType)) {
    return sendError(res, 400, "A valid `postType` is required (photo | carousel | reel | story).");
  }
  if (body.imageBase64 && !body.imageMediaType) {
    return sendError(res, 400, "`imageMediaType` is required when `imageBase64` is provided.");
  }

  try {
    const result = await generateCaptions(body);
    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Caption generation failed.";
    return sendError(res, 502, message);
  }
}
