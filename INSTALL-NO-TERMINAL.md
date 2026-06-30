# Docs Hub — No-Install, Browser-Only Setup

For a locked-down laptop where you **cannot install anything** and have **no
terminal**. Everything here happens on websites, in your browser, using your
accounts. Your laptop never builds anything — GitHub's and Cloudflare's servers
do. Nothing gets installed on your machine.

Total time: ~40 minutes. After each step there's a **"You should see"** so you
know it worked.

## The picture
Two things go online:
- **Worker** (on Cloudflare) — secretly holds your Claude key, does the AI calls.
- **App** (on GitHub Pages) — what people open; it asks the Worker for the AI bits.

You set the key once, in Cloudflare's website. Done.

---

# PART A — Accounts (~10 min)

Create these three (all free, all in the browser):
1. **GitHub** — github.com
2. **Cloudflare** — dash.cloudflare.com/sign-up
3. **Anthropic key** — console.anthropic.com → **API Keys** → **Create Key** →
   copy it (starts `sk-ant-`) into a note. Then **Billing** → add a few dollars
   of credit.

---

# PART B — Put the code on GitHub (no terminal) (~12 min)

We'll upload the files through GitHub's website.

### B1. Make the repository
1. github.com → click **+** (top-right) → **New repository**.
2. Name it exactly: **docs-hub**
3. Tick **"Add a README file"** (so the repo isn't empty).
4. Click **Create repository**.

**You should see** your new repo page.

### B2. Upload the app files
1. On the repo page, click **Add file** → **Upload files**.
2. On your laptop, unzip `docs-hub.zip`. Open the resulting **docs-hub** folder.
3. Select **everything inside** it (the `src` folder, `worker` folder,
   `package.json`, `index.html`, `vite.config.js`, the `.github` folder, etc.)
   and **drag it all** onto the GitHub upload page.
   - Important: drag the **contents**, not the outer docs-hub folder itself.
   - If the `.github` folder doesn't upload (some browsers hide dot-folders),
     don't worry — Part C handles the build file directly.
4. Scroll down, click **Commit changes**.

**You should see** your files listed on the repo page (src, worker,
package.json, …).

> Tip: if drag-and-drop misses the hidden `.github` folder, that's fine — we
> create that file by hand in Part C2.

---

# PART C — Switch on the website build (~6 min)

GitHub will build the app on its own servers.

### C1. Turn on Pages
Repo → **Settings** (top) → **Pages** (left menu) → under **Source** choose
**GitHub Actions**. (Don't pick a branch — pick "GitHub Actions".)

### C2. Make sure the build recipe exists
1. Repo → **Add file** → **Create new file**.
2. In the filename box type exactly:
   `.github/workflows/deploy.yml`
   (typing the slashes creates the folders automatically)
3. Open the `deploy.yml` from your unzipped folder (in any text viewer), copy
   all of it, and paste it into the big box. *(If it already uploaded in Part B,
   GitHub will warn the file exists — then just skip this, click away.)*
4. Click **Commit changes**.

### C3. Add the two settings the app needs
Repo → **Settings** → **Secrets and variables** (left) → **Actions** →
**Variables** tab → **New repository variable**. Add two:

| Name (exact) | Value |
|---|---|
| `VITE_BASE` | `/docs-hub/` |
| `VITE_ORACLE_URL` | *(leave blank for now — we fill this after Part D)* |

For `VITE_ORACLE_URL`, just put a placeholder like `https://x` for the moment;
we'll come back and set the real Worker URL.

**You should see** both variables listed.

---

# PART D — Create the Worker entirely in Cloudflare's website (~12 min)

No terminal — Cloudflare has a browser editor.

### D1. New Worker
1. dash.cloudflare.com → left menu **Workers & Pages** → **Create application**
   → **Create Worker**.
2. Name it **docs-hub-oracle** → **Deploy** (it deploys a default "Hello World"
   — that's fine, we replace it next).

**You should see** a success page with a URL like
`https://docs-hub-oracle.YOURNAME.workers.dev`. **Copy that URL.**

### D2. Paste in the real code
1. Click **Edit code** (top right).
2. In your unzipped folder open `worker/worker.js` in a text viewer, copy ALL of
   it.
3. In the Cloudflare editor, select everything in the main file and delete it,
   then paste the worker.js code.
4. Click **Deploy** (top right).

### D3. Add your Claude key (the "once" step)
1. Go back to the Worker's page → **Settings** → **Variables and Secrets**
   (or "Settings → Variables").
2. Under **Secrets** (not plain variables) click **Add**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: paste your `sk-ant-…` key
   - Type: **Secret** (encrypted)
   - Save.
3. While here, under **Variables** add:
   - Name: `ALLOWED_ORIGIN`
   - Value: `https://YOURNAME.github.io`  (your GitHub username; no repo name)
4. Save / Deploy.

### D4. Add the cache (optional but makes re-runs free)
1. Worker page → it may prompt for a **KV namespace** binding. If you want
   caching: left menu **Workers & Pages → KV → Create namespace**, name it
   `CACHE`. Then in the Worker → **Settings → Bindings → Add → KV namespace**,
   variable name `CACHE`, pick the namespace you made. Deploy.
   *(Skip this and it still works, just without the free-re-run cache.)*

**You should see** the Worker deployed with the key saved.

---

# PART E — Connect the app to the Worker & build (~5 min)

1. GitHub repo → **Settings → Secrets and variables → Actions → Variables**.
2. Edit `VITE_ORACLE_URL` → set it to your Worker URL from D1. Save.
3. Repo → **Actions** tab → click **Deploy to GitHub Pages** (left) → **Run
   workflow** → **Run workflow**. Wait ~2 min for a green tick.

**You should see**, at Settings → Pages, your live link:
`https://YOURNAME.github.io/docs-hub/` — open it!

---

# PART F — Use it
1. Open `https://YOURNAME.github.io/docs-hub/`
2. **Settings → Knowledge base → Upload KB folder** → your `.md` files.
3. **Scoper** → add briefs → **Run Oracle 🔮**.
4. **QA Checker** → paste an article URL → **Score**.

---

# If something's off
- **"Oracle not configured"** → `VITE_ORACLE_URL` is still the placeholder, or you
  didn't re-run the Action (Part E) after setting it.
- **Blank page / 404** → `VITE_BASE` must be exactly `/docs-hub/`.
- **"Origin not allowed"** → `ALLOWED_ORIGIN` in the Worker (D3) must match your
  Pages address exactly: `https://YOURNAME.github.io`.
- **AI error / 401 / billing** → check the key and that you added credit (Part A).
- Stuck? Note the Part + number and the exact on-screen message.

## Why this avoids the install problem
GitHub builds the app on its servers; Cloudflare runs the Worker on theirs. Your
laptop only opens websites and uploads files — nothing installs locally, so IT's
lockdown doesn't get in the way.
