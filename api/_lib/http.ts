import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Apply permissive same-origin CORS + handle preflight. Returns true if handled. */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

/** Send a JSON error with a status code. */
export function sendError(res: VercelResponse, status: number, message: string): void {
  res.status(status).json({ error: message });
}

/** Parse the JSON body whether Vercel pre-parsed it or handed us a raw string. */
export function parseBody<T>(req: VercelRequest): T {
  if (req.body == null) return {} as T;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      return {} as T;
    }
  }
  return req.body as T;
}
