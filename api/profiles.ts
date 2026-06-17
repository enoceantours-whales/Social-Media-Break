import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, sendError } from "./_lib/http.js";
import { listProfiles } from "./_lib/buffer.js";

/**
 * GET /api/profiles — list the Buffer channels connected to the configured
 * token. Handy for discovering profile IDs to pin per brand in env vars.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return sendError(res, 405, "Use GET.");

  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) {
    return res.status(200).json({ demo: true, profiles: [] });
  }

  try {
    const profiles = await listProfiles(token);
    return res.status(200).json({ demo: false, profiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list Buffer profiles.";
    return sendError(res, 502, message);
  }
}
