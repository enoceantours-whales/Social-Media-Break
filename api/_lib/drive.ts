import crypto from "node:crypto";
import type { UploadMediaResponse } from "../../shared/types.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Mint a short-lived Drive access token from service-account credentials (JWT bearer flow). */
async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = base64url(signer.sign(privateKey));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token response had no access_token.");
  return data.access_token;
}

/**
 * Upload media to Google Drive, share it publicly, and return a directly-
 * fetchable URL suitable for Buffer's media attachment.
 *
 * Falls back to demo mode (no upload) when service-account creds are absent.
 */
export async function uploadToDrive(
  base64: string,
  filename: string,
  mimeType: string,
): Promise<UploadMediaResponse> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Vercel stores multi-line keys with escaped newlines; restore them.
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!email || !privateKey) {
    return { url: null, fileId: null, demo: true };
  }

  const token = await getAccessToken(email, privateKey);
  const fileBuffer = Buffer.from(base64, "base64");

  // Multipart upload: metadata part + media part.
  const boundary = "smb" + crypto.randomBytes(8).toString("hex");
  const metadata: Record<string, unknown> = { name: filename };
  if (folderId) metadata.parents = [folderId];

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    ),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const upRes = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!upRes.ok) {
    throw new Error(`Drive upload failed (${upRes.status}): ${await upRes.text()}`);
  }
  const { id } = (await upRes.json()) as { id?: string };
  if (!id) throw new Error("Drive upload returned no file id.");

  // Make it readable by anyone with the link so Buffer can fetch it.
  const permRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );
  if (!permRes.ok) {
    throw new Error(`Drive permission grant failed (${permRes.status}): ${await permRes.text()}`);
  }

  // Direct-download form serves the raw bytes (works for images Buffer fetches).
  return {
    url: `https://drive.google.com/uc?export=download&id=${id}`,
    fileId: id,
    demo: false,
  };
}
