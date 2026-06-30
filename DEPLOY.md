# Deploy Docs Hub (Cloudflare Worker + GitHub Pages)

The Claude key lives ONLY in the Cloudflare Worker (server-side). The app (on
GitHub Pages) calls the Worker. No key is ever in a browser or the repo.

## 1. Deploy the Worker (holds the key)

```bash
cd worker
npm install -g wrangler           # one-time
wrangler login                    # opens browser, log in to Cloudflare (free)

# Create the cache, then paste the printed id into wrangler.toml (kv_namespaces.id):
wrangler kv namespace create CACHE

# Set the single Claude key as a SECRET (never in code):
wrangler secret put ANTHROPIC_API_KEY      # paste your key when prompted

# Lock the Worker to your Pages origin — edit wrangler.toml:
#   ALLOWED_ORIGIN = "https://<you>.github.io"     (your Pages origin)

wrangler deploy
# Note the URL it prints, e.g. https://docs-hub-oracle.<you>.workers.dev
```

## 2. Deploy the app (GitHub Pages)

```bash
git init && git add -A && git commit -m "Docs Hub"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then in the repo:
- **Settings -> Pages -> Source: GitHub Actions**
- **Settings -> Secrets and variables -> Actions -> Variables**, add:
  - `VITE_BASE` = `/<repo>/`  (e.g. `/docs-hub/`)
  - `VITE_ORACLE_URL` = the Worker URL from step 1

Push (or re-run the action). Your app: `https://<you>.github.io/<repo>/`.

## Economy built in
- Scoper pre-filters the KB locally (zero tokens) and sends the Worker only
  heading digests; the Worker uses **Haiku** and **caches** results (24h), so
  re-running a brief is free.
- QA Checker fetches + runs link/heading/visual checks in the Worker, then makes
  **one** Claude (**Sonnet**) call for all judgment criteria, cached by URL.
- Models are set at the top of `worker/worker.js`.

## Note on access
The Pages URL is public (anyone can open it), but the Worker is locked to your
origin and holds the only key, so outsiders can't use your Claude credits. If you
later need to restrict *who can open the app*, that needs auth in front (e.g.
Cloudflare Access on a Cloudflare-Pages-hosted version) — ask and I'll wire it.
