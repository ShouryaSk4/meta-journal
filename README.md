# Meta Journal

A single-file static daily journal with **voice log** support. Data lives in Supabase. Deploy to Vercel — one small serverless function parses speech into form fields using **Gemini 3.1 Flash Lite**.

## 1. Create the table in Supabase

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the contents of `supabase_schema.sql` and run it.

## Local dev — Gemini Live STT (replaces browser speech)

Uses **`gemini-3.5-live-translate-preview`** for real-time speech-to-text via the Gemini Live API (WebSocket). Browser Web Speech is still available as a fallback.

```bash
npm install
npm run dev
```

Open **http://localhost:3000** (not `file://`). In Voice log, select **Gemini Live STT**, tap **Record**, speak, **Stop**, then **Process**.

Requires `GEMINI_API_KEY` in `.env`. Optional: `GEMINI_LIVE_MODEL=gemini-3.5-live-translate-preview`.

For **Process** (fill form fields), run `npm run vercel:dev` instead — or deploy to Vercel so `/api/parse-log` works.

## 2. Voice log (speech → form)

At the top of the Log tab:

1. Pick **English (India)** or another locale (helps Chrome recognition).
2. Tap **Record** and talk through your whole day in one go.
3. Watch the **live caption** (gray italic) while you speak; the **textarea** holds finalized text.
4. Tap **Stop**, then **Process** (Gemini 3.1 Flash Lite extracts scores and fields).
5. Review, tweak, then **Commit the day**.

You can also type or paste into the transcript box instead of using the mic.

**Speech (free, browser):**

- Chrome or Edge — Web Speech API with `maxAlternatives`, live interim captions, mic level meter, timer.
- Default language: **English (India)** (`en-IN`). Switch to US/UK if that fits you better.
- No paid STT API — recognition runs in the browser.

**Parsing (Gemini, free tier on Google AI Studio):**

- Add `GEMINI_API_KEY` in Vercel → Settings → Environment Variables (from [Google AI Studio](https://aistudio.google.com/apikey)).
- Optional: `GEMINI_MODEL` defaults to `gemini-3.1-flash-lite`.
- Key stays on the server in `/api/parse-log` — never in the HTML.

Local dev:

```bash
vercel dev
```

Put `GEMINI_API_KEY=...` in your local `.env` (not committed).

**Deployment:** Process calls `/api/parse-log` on your Vercel domain. Opening `index.html` as a file won't work for Process — use `vercel dev` or deploy.

## 3. Deploy to Vercel

Static site + `api/parse-log.js` serverless function.

1. Framework preset: **Other**. No build command. No output directory.
2. Environment variables:
   - `GEMINI_API_KEY` — required for Process
   - Optional: `GEMINI_MODEL=gemini-3.1-flash-lite`
3. Root file: `index.html` is served at `/`.

```bash
vercel
```

## Credentials summary

| Variable | Where | Purpose |
|----------|-------|---------|
| `GEMINI_API_KEY` | Vercel env only | Parse voice/text with Gemini 3.1 Flash Lite |
| Supabase URL + anon key | In `index.html` | Browser → Supabase (public) |
| Service role / Postgres password | Never deploy | Not used |

## Features

- **Log** — manual form, voice log (live captions + meter), export/import JSON
- **Today** — dashboard for latest entry
- **Weekly** — 7-day trends and insights
- **Supabase** — upsert on `entry_date`, wipe all, multi-device sync
