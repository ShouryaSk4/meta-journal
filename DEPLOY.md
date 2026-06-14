# Deploy Meta Journal

## 1. GitHub

This folder is ready to push as a repo root (no `node_modules`, no `.env`).

1. Create a new repository on GitHub (empty, no template).
2. Upload this entire folder, or unzip `meta-journal.zip` and upload the contents.
3. Ensure `index.html` is at the repo root.

## 2. Supabase (one time)

In Supabase → SQL Editor, run:

1. `supabase_schema.sql`
2. `supabase_fix_grants.sql`

Supabase URL and anon key are already in `index.html`.

## 3. Vercel

1. Import the GitHub repo.
2. Framework preset: **Other**
3. Build command: leave empty
4. Output directory: leave empty
5. Environment variables:
   - `GEMINI_API_KEY` — required (from Google AI Studio)
   - `GEMINI_MODEL` — optional (`gemini-3.1-flash-lite`)
6. Deploy.

## 4. Local dev

```bash
npm install
cp .env.example .env   # add your GEMINI_API_KEY
npm run dev            # http://localhost:3000 — Gemini Live STT + Process
```

## Production vs local

| Feature | Vercel | Local `npm run dev` |
|---------|--------|---------------------|
| Log + Supabase | Yes | Yes |
| Process (fill form) | Yes | Yes |
| Gemini Live STT | No | Yes |
| Browser speech STT | Yes | Yes |
