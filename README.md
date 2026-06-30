# Docs Hub (Nexudus)

Unified documentation control: **Dashboard**, **QA Checker**, **Tracker**,
**Projects**, and **Scoper** (the Oracle 🔮). A real React app, so the Scoper
does genuine KB lookups via Gemini.

## Run locally

```bash
npm install
npm run dev          # open the printed localhost URL
```

Set up the Cloudflare Worker (holds the shared Claude key) and point the app at
it — see **DEPLOY.md**. Then Settings -> upload your KB folder of `.md` files,
and use the Scoper. To run locally, set `VITE_ORACLE_URL` in a `.env` file.

## Deploy

See **DEPLOY.md** — Cloudflare Worker (holds the single Claude key, server-side)
plus GitHub Pages for the app. One key, set once, never in any browser.

## How the Scoper stays cheap

`src/lib/kb.js` indexes the KB and pre-filters each brief to a few candidates
with local keyword scoring (zero tokens). `src/lib/oracle.js` then sends Gemini
only the heading **digests** of those candidates — one focused call. The "This
run" panel shows what was scanned free vs. sent to the model.

## Map

- `src/app.jsx` — shell + Dashboard, Tracker, Projects, Settings, key modal
- `src/screens/Scoper.jsx` — briefs → Oracle → report → task
- `src/lib/kb.js` — KB load, index, pre-filter (no model calls)
- `src/lib/oracle.js` — calls the Worker
- `worker/worker.js` — holds the Claude key; scope + QA endpoints, caching
- - `src/lib/theme.js`, `src/components/ui.jsx` — tokens + shared UI

## Notes

- KB index and tasks are in-memory; re-upload the KB after a restart. Persisting
  them (disk, or a Sheet/Drive backend) is the natural next step.
- Change the model in `src/lib/oracle.js` (`MODEL`).
