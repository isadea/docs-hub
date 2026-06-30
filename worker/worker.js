// Docs Hub Oracle Worker
// Holds the single Claude key (as a Worker secret), so it is NEVER in any browser.
// The app POSTs candidate digests / article text here; the Worker calls Anthropic
// and returns structured JSON. Results are cached in KV so re-runs don't re-bill.
//
// Endpoints:  POST /scope   { brief, candidates[] }      -> { dependencies[] }
//             POST /qa      { url, title, category, text } -> { criteria[] }
//
// Economy built in:
//   - small models by default (Haiku for scope, Sonnet for QA judgment)
//   - max_tokens capped tight; temperature 0
//   - KV cache keyed by a hash of the exact input (24h) -> identical re-runs are free
//   - the app only ever sends pre-filtered digests, never the whole KB

const MODEL_SCOPE = "claude-haiku-4-5-20251001";
const MODEL_QA = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN)
      return json({ error: "Origin not allowed" }, 403, cors);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "Server missing ANTHROPIC_API_KEY" }, 500, cors);

    const url = new URL(req.url);
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400, cors); }

    try {
      if (url.pathname.endsWith("/scope")) return json(await scope(body, env), 200, cors);
      if (url.pathname.endsWith("/qa")) return json(await qa(body, env), 200, cors);
      return json({ error: "Unknown endpoint" }, 404, cors);
    } catch (e) {
      return json({ error: e.message || "Worker error" }, 500, cors);
    }
  },
};

// ---- Scoper: which candidate articles need updating for this brief ----
async function scope(body, env) {
  const { brief, candidates } = body;
  if (!brief || !Array.isArray(candidates) || !candidates.length) return { dependencies: [] };
  const cacheKey = "scope:" + (await sha(JSON.stringify({ b: brief, c: candidates.map((c) => c.slug + c.digest) })));
  const hit = await cacheGet(env, cacheKey);
  if (hit) return { ...hit, cached: true };

  const block = candidates.map((c) => `slug: ${c.slug}\n${c.digest}`).join("\n\n---\n\n");
  const prompt =
    `You are a documentation dependency analyst for Nexudus.\n` +
    `Decide which existing KB articles need updating for this change.\n\n` +
    `CHANGE BRIEF\nType: ${brief.type}\nTitle: ${brief.title}\nDetails: ${brief.text}\n\n` +
    `CANDIDATE ARTICLES (title + headings only):\n${block}\n\n` +
    `Return ONLY JSON: {"dependencies":[{"slug","likelihood":"High|Medium|Low","reasoning","recommendedChanges","changeType":"text|image"}]}. ` +
    `Use the slug exactly as shown. Include only articles that genuinely need updating.`;

  const data = await callClaude(env, MODEL_SCOPE, 1024, prompt);
  const parsed = extractJSON(data) || { dependencies: [] };
  await cachePut(env, cacheKey, parsed);
  return parsed;
}

// ---- QA: fetch article, run deterministic checks, judge the rest in ONE call ----
async function qa(body, env) {
  const { url, category, judgmentCriteria } = body;
  if (!url) return { error: "No URL" };
  const cacheKey = "qa:" + (await sha(JSON.stringify({ url, category })));
  const hit = await cacheGet(env, cacheKey);
  if (hit) return { ...hit, cached: true };

  // Fetch the article server-side (avoids browser CORS).
  let html = "";
  try { const r = await fetch(url, { headers: { "user-agent": "DocsHubQA/1.0" } }); html = await r.text(); }
  catch (e) { return { error: "Could not fetch article: " + e.message }; }

  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [, ""])[1].trim();
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // Deterministic checks (no model).
  const links = [...html.matchAll(/href=["\']([^"\']+)["\']/gi)].map((m) => m[1]).filter((h) => h.startsWith("http"));
  const headings = [...html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => m[2].replace(/<[^>]+>/g, "").trim());
  const images = [...html.matchAll(/<img[\s>]/gi)].length;
  const det = {
    links_verified: links.length ? 1 : 0.5,
    visuals_present: images >= 2 ? 1 : images === 1 ? 0.5 : 0,
    heading_structure: headings.length >= 3 ? 1 : headings.length ? 0.5 : 0,
  };

  // Judgment criteria — one Claude call over the article text.
  const list = (judgmentCriteria || []).map((c) => `- ${c.id}: ${c.check}`).join("\n");
  const prompt =
    `You are a documentation QA reviewer for Nexudus. Category: ${category}.\n` +
    `ARTICLE TEXT:\n${text.slice(0, 12000)}\n\n` +
    `Score EACH criterion 1 (met), 0.5 (partial), 0 (not met), with one short finding.\n${list}\n\n` +
    `Return ONLY JSON {"criteria":[{"id","score","finding"}]}.`;
  let judged = { criteria: [] };
  if (list) { const out = await callClaude(env, MODEL_QA, 1024, prompt); judged = extractJSON(out) || { criteria: [] }; }

  const result = { title, deterministic: det, detail: { links_verified: `${links.length} links found`, visuals_present: `${images} images`, heading_structure: `${headings.length} headings` }, criteria: judged.criteria || [] };
  await cachePut(env, cacheKey, result);
  return result;
}

// ---- helpers ----
async function callClaude(env, model, max_tokens, prompt) {
  const r = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens, temperature: 0, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}
function extractJSON(s) { try { const m = s.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; } }
async function cacheGet(env, k) { if (!env.CACHE) return null; const v = await env.CACHE.get(k); return v ? JSON.parse(v) : null; }
async function cachePut(env, k, v) { if (env.CACHE) await env.CACHE.put(k, JSON.stringify(v), { expirationTtl: 86400 }); }
async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
function corsHeaders(origin, env) {
  const allow = env.ALLOWED_ORIGIN || origin || "*";
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" };
}
function json(obj, status, cors) { return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", ...cors } }); }
