import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, parseBody, sendError } from "./_lib/http.js";
import { schedulePost } from "./_lib/buffer.js";
import { BRANDS } from "../shared/brands.js";
import { POST_TYPES, PLATFORMS } from "../shared/types.js";
import type { SchedulePostRequest } from "../shared/types.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return sendError(res, 405, "Use POST.");

  const body = parseBody<SchedulePostRequest>(req);

  if (!body.brand || !BRANDS[body.brand]) {
    return sendError(res, 400, "A valid `brand` is required (enocean | smp).");
  }
  if (!body.postType || !POST_TYPES.includes(body.postType)) {
    return sendError(res, 400, "A valid `postType` is required.");
  }
  if (body.platforms) {
    if (body.platforms.length === 0) {
      return sendError(res, 400, "Select at least one platform to post to.");
    }
    if (body.platforms.some((p) => !PLATFORMS.includes(p))) {
      return sendError(res, 400, "`platforms` contains an unknown platform.");
    }
  }
  const selected = body.platforms ?? PLATFORMS;
  if (!body.captions || selected.some((p) => !body.captions[p]?.text)) {
    return sendError(res, 400, "`captions` must include text for every selected platform.");
  }
  if (body.scheduledAt && Number.isNaN(Date.parse(body.scheduledAt))) {
    return sendError(res, 400, "`scheduledAt` must be a valid ISO 8601 timestamp.");
  }

  try {
    const result = await schedulePost(body);
    return res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scheduling failed.";
    return sendError(res, 502, message);
  }
}
