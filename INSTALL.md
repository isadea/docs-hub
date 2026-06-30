# Docs Hub — Full Installation & Deployment Guide

From nothing to a live URL. Follow top to bottom. Two things get deployed:
- **The Worker** (Cloudflare): holds your Claude key, does the AI calls.
- **The App** (GitHub Pages): what people open in a browser; it calls the Worker.

You set the Claude key ONCE, in the Worker. It's never in the app or a browser.

---

## What you need first (one-time)

1. **Node.js 20+** — check with `node -v`. If missing, install from nodejs.org
   (the "LTS" button). This also installs `npm`.
2. **A GitHub account** — github.com
3. **A Cloudflare account** — dash.cloudflare.com/sign-up (free)
4. **An Anthropic API key** — console.anthropic.com -> API Keys -> Create.
   Add a little credit under Billing (a few dollars lasts a long time with
   caching). Copy the key (starts with `sk-ant-`). Keep it somewhere safe.

Unzip the project somewhere you'll find it, then open a terminal in that folder
(the one containing `package.json`).

---

## Step 1 — Run it locally first (sanity check, ~3 min)

This proves the app works before any deployment.

```bash
npm install
```

You can't scope/QA yet (no Worker), but the app should open:

```bash
npm run dev
```

Open the URL it prints (usually http://localhost:5173). Click around —
Dashboard, Tracker, Projects all work. Press Ctrl+C in the terminal to stop.

---

## Step 2 — Deploy the Worker (holds the key) (~10 min)

```bash
cd worker
npm install -g wrangler        # Cloudflare's tool
wrangler login                 # opens a browser; approve access
```

**2a. Create the cache** (so repeat runs are free):

```bash
wrangler kv namespace create CACHE
```

It prints a block with an `id = "xxxx…"`. Copy that id.
Open `worker/wrangler.toml`, find `id = "REPLACE_WITH_KV_ID"`, and paste your id
between the quotes.

**2b. Add your Claude key as a secret** (this is the "set once" step):

```bash
wrangler secret put ANTHROPIC_API_KEY
```

Paste your `sk-ant-…` key when prompted, press Enter. It's stored encrypted on
Cloudflare — not in any file.

**2c. Deploy:**

```bash
wrangler deploy
```

It prints a URL like `https://docs-hub-oracle.YOURNAME.workers.dev`.
**Copy that URL — you need it in Step 3.**

> Leave `ALLOWED_ORIGIN` in wrangler.toml as-is for now. You'll set it in Step 4
> once you know your Pages URL, then redeploy the Worker.

---

## Step 3 — Put the app on GitHub (~5 min)

Back in the main project folder (`cd ..` if you're still in `worker`):

```bash
git init
git add -A
git commit -m "Docs Hub"
git branch -M main
```

Create an empty repo on github.com (the "+" -> New repository; don't add a
README). Then connect and push (swap in your username + repo name):

```bash
git remote add origin https://github.com/YOURNAME/REPONAME.git
git push -u origin main
```

---

## Step 4 — Turn on Pages + point it at the Worker (~5 min)

In your repo on github.com:

**4a.** Settings -> Pages -> under "Build and deployment", set **Source** to
**GitHub Actions**.

**4b.** Settings -> Secrets and variables -> Actions -> **Variables** tab ->
**New repository variable**, add these two:

| Name | Value |
|------|-------|
| `VITE_BASE` | `/REPONAME/`  (your repo name with slashes, e.g. `/docs-hub/`) |
| `VITE_ORACLE_URL` | the Worker URL from Step 2c |

**4c.** Trigger a build: Actions tab -> "Deploy to GitHub Pages" -> Run
workflow (or just push any small change). Wait for the green check (~1–2 min).

Your app is now live at: **https://YOURNAME.github.io/REPONAME/**

---

## Step 5 — Lock the Worker to your app (~2 min)

Now that you know your app URL, restrict the Worker so only your app can use it
(stops anyone else spending your Claude credit):

Open `worker/wrangler.toml`, set:

```
ALLOWED_ORIGIN = "https://YOURNAME.github.io"
```

(Just the origin — no repo path.) Then redeploy:

```bash
cd worker
wrangler deploy
```

Done. 🎉

---

## Step 6 — Use it

1. Open your Pages URL.
2. **Settings -> Knowledge base -> Upload KB folder** — pick your folder of
   `.md` files. (Re-upload whenever you refresh it; every couple of weeks is fine.)
3. **Scoper** -> add briefs -> **Run Oracle 🔮**.
4. **QA Checker** -> paste an article URL -> **Score**.

---

## Updating the app later

Just push changes — Pages rebuilds automatically:

```bash
git add -A && git commit -m "tweak" && git push
```

To change the AI models or costs, edit the top of `worker/worker.js`, then
`cd worker && wrangler deploy`.

---

## Troubleshooting

- **Scoper/QA says "Oracle not configured"** — `VITE_ORACLE_URL` variable is
  missing or you didn't re-run the Action after adding it. Add it (Step 4b) and
  re-run the workflow.
- **"Origin not allowed"** — `ALLOWED_ORIGIN` in wrangler.toml doesn't match your
  Pages origin. Fix it and `wrangler deploy` again (Step 5).
- **App loads but is blank / 404 on refresh** — `VITE_BASE` is wrong. It must be
  `/REPONAME/` exactly, with both slashes.
- **"Server missing ANTHROPIC_API_KEY"** — the secret didn't save. Redo Step 2b.
- **Claude 401 / 400 from the Worker** — the key is wrong or has no billing
  credit. Check console.anthropic.com.
- **KB upload does nothing** — make sure you pick a *folder* containing `.md`
  files (the picker says "Upload"). Other file types are ignored.

## Costs
Pennies in normal use: the Scoper uses the cheap Haiku model over tiny digests,
QA makes one Sonnet call per article, and everything is cached for 24h so
re-runs are free. Keep an eye on console.anthropic.com -> Usage the first week.
