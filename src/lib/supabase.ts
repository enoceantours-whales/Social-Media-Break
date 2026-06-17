// Public Supabase Storage config. These values are safe to ship in client code:
// the anon key is a public key, protected by row-level security (uploads are
// restricted to the `media` bucket by an RLS policy).
const SUPABASE_URL = "https://czotpzjtnuukoxscjduj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b3Rwemp0bnV1a294c2NqZHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTIzNDcsImV4cCI6MjA5MzU4ODM0N30.o1sAH23f-AgLmRhBiCptySJkEV3nnQqNxmldA6evx9c";
const BUCKET = "media";

/** Make a filesystem-safe object name. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Upload media straight from the browser to Supabase Storage and return its
 * public URL (for Buffer to attach). Uses XHR so we get real upload progress,
 * and Supabase Storage allows browser uploads without CORS headaches.
 */
export function uploadMediaToSupabase(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const path = `${Date.now()}-${safeName(file.name)}`;
  const endpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.setRequestHeader("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("x-upsert", "true");
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.timeout = 120_000;

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(publicUrl);
      } else if (xhr.status === 413) {
        reject(new Error("File is too large for the 50 MB upload limit."));
      } else {
        reject(new Error(`Media upload failed (${xhr.status}): ${xhr.responseText || "no response"}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during media upload."));
    xhr.ontimeout = () => reject(new Error("Media upload timed out."));
    xhr.send(file);
  });
}
