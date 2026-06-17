# 🌊 Social Media Break

A lightweight web app that lets you upload a photo or video, auto-generate
platform-specific captions with **Claude**, pick a brand account, choose a post
type, and schedule to **Instagram, Facebook, Twitter/X, and LinkedIn** via the
**Buffer API** — without ever opening a social media app.

Built for posting consistently to **Enocean Tours** (whale watching) and
**Slater Moore Photography** while staying out of the social feed entirely.

---

## How it works

1. **Upload** a video or photo (MP4/MOV/WebM, JPG/PNG/WebP) — with a live preview.
2. **Select brand** — Enocean Tours or Slater Moore Photography (each has its own voice).
3. **Select post type** — Photo, Carousel, Reel, or Story.
4. **Generate captions** — Claude writes one caption per platform, tuned to that
   platform's format and the brand's voice. Photos are analyzed with vision; for
   videos, add a one-line context note. Edit any caption before posting.
5. **Schedule & post** — sends to Buffer at the brand's default time (Enocean:
   9am weekdays / 10am weekends PT; SMP: 6pm PT daily), or a time you pick.

---

## Tech stack

- **Frontend:** React + Vite (TypeScript)
- **Backend:** Vercel serverless functions (`/api/*.ts`)
- **AI:** Anthropic Claude API (`claude-opus-4-8`) for caption generation
- **Scheduling:** Buffer API (Instagram, Facebook, Twitter/X, LinkedIn)
- **Deployment:** Vercel (static frontend + serverless API)

```
shared/      Types + brand config shared by frontend and backend
api/         Serverless functions
  _lib/      Claude, Buffer, and HTTP helpers
  generate-captions.ts   POST — Claude caption generation
  schedule-post.ts       POST — schedule to Buffer
  blob-upload.ts         POST — mint tokens for direct-to-Blob media uploads
  profiles.ts            GET  — list connected Buffer channels
src/         React app (components, API client, styles)
```

---

## Local development

```bash
npm install
cp .env.example .env     # fill in keys (optional — see Demo mode below)

# Run frontend + serverless functions together (recommended):
npx vercel dev

# Or run the Vite frontend on its own:
npm run dev
```

> Running plain `npm run dev` serves the UI but not the `/api` functions. To
> point Vite at functions hosted elsewhere, set `VITE_API_PROXY`
> (e.g. `VITE_API_PROXY=http://localhost:3000 npm run dev`).

Other scripts:

```bash
npm run build       # type-check + production build into dist/
npm run typecheck   # type-check only
```

---

## Demo mode (no keys required)

The app is fully clickable without any API keys:

- **No `ANTHROPIC_API_KEY`** → `/api/generate-captions` returns brand-appropriate
  sample captions, flagged as demo in the UI.
- **No `BUFFER_ACCESS_TOKEN`** → `/api/schedule-post` reports success without
  sending anything to Buffer.

Add the real keys to switch each piece into live mode independently.

---

## Configuration

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key for caption generation |
| `BUFFER_ACCESS_TOKEN` | Buffer access token for scheduling |
| `BUFFER_PROFILES_ENOCEAN` | Optional: pin Buffer profile IDs for Enocean, e.g. `instagram:5f…,facebook:5a…` |
| `BUFFER_PROFILES_SMP` | Optional: same, for Slater Moore Photography |
| `BLOB_READ_WRITE_TOKEN` | Media hosting via Vercel Blob — auto-injected when you connect a Blob store |

If the brand profile vars are not set, the app auto-matches the first connected
Buffer channel per network. Call `GET /api/profiles` (with a token configured)
to discover your channel IDs.

### Media hosting (Vercel Blob)

Buffer attaches media from a public URL. On the Schedule step, the browser
uploads your photo/video **directly to Vercel Blob** — bypassing the serverless
body limit, so large videos (40 MB+) work — and the resulting public URL is sent
to Buffer. To enable it: in Vercel, go to **Storage → Create → Blob** and
**connect** the store to this project. Vercel injects `BLOB_READ_WRITE_TOKEN`
automatically; redeploy and uploads are live. Without it, posts are scheduled as
text (or paste your own hosted URL in the Schedule step).

---

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Set `ANTHROPIC_API_KEY`, `BUFFER_ACCESS_TOKEN` (and optionally the brand
   profile vars) in the Vercel project's Environment Variables.
3. For media attachment, create a **Blob** store (Storage → Create → Blob) and
   connect it to the project — `BLOB_READ_WRITE_TOKEN` is injected automatically.
4. Deploy. `vercel.json` configures the Vite build, serves `/api/*` as
   functions, and rewrites all other routes to the SPA.

---

## Notes & limitations

- **Media attachment:** Handled via Vercel Blob (see above) — the browser uploads
  directly, so large photos/videos attach without hitting the serverless body
  limit. A manual hosted URL still overrides it if you prefer.
- **Phase 2 ideas:** multi-image carousel upload, saved drafts, post history,
  and batch scheduling — see the project brief.
