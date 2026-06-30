// ------------------------------------------------------------------
// The Oracle (client side). Talks to the Cloudflare Worker, which holds the
// single Claude key server-side. The browser never sees the key.
//
// Economy: we pre-filter locally (free, zero tokens) and send the Worker only
// the heading digests of the candidates. The Worker uses Haiku + caches results,
// so identical re-runs cost nothing.
// ------------------------------------------------------------------
import { preFilter } from "./kb.js";
import { TIME_RULES } from "./theme.js";

// Set at build time (VITE_ORACLE_URL) to your Worker URL, e.g.
// https://docs-hub-oracle.<you>.workers.dev
const ORACLE_URL = (import.meta.env && import.meta.env.VITE_ORACLE_URL) || "";

export function oracleConfigured() { return !!ORACLE_URL; }

async function callWorker(path, payload) {
  if (!ORACLE_URL) throw new Error("Oracle URL not configured. Set VITE_ORACLE_URL to your Worker URL.");
  const r = await fetch(ORACLE_URL.replace(/\/$/, "") + path, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Oracle ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Analyse ONE brief: pre-filter locally, send digests to the Worker.
export async function scopeBrief(brief, index, net) {
  const candidates = preFilter(`${brief.title}\n${brief.text}`, index, net);
  if (!candidates.length) return { deps: [], candidates: 0, scanned: index.length };

  const slim = candidates.map((c) => ({ slug: c.slug, digest: c.digest }));
  const out = await callWorker("/scope", { brief: { type: brief.type, title: brief.title, text: brief.text }, candidates: slim });

  const bySlug = Object.fromEntries(candidates.map((c) => [c.slug, c]));
  const deps = (out.dependencies || [])
    .filter((d) => bySlug[d.slug])
    .map((d) => ({
      slug: d.slug, title: bySlug[d.slug].title,
      likelihood: d.likelihood || "Medium", reasoning: d.reasoning || "", recommendedChanges: d.recommendedChanges || "",
      kind: d.changeType === "image" ? "image" : "text",
      estimate: TIME_RULES[d.changeType === "image" ? "image" : "text"],
      checked: (d.likelihood || "Medium") !== "Low",
    }));
  return { deps, candidates: candidates.length, scanned: index.length, cached: !!out.cached };
}

export async function runOracle(briefs, index, net, onProgress) {
  const reports = [];
  let matched = 0, digestChars = 0, fullChars = 0;
  for (let i = 0; i < briefs.length; i++) {
    onProgress?.(i, briefs.length, briefs[i]);
    const cands = preFilter(`${briefs[i].title}\n${briefs[i].text}`, index, net);
    matched += cands.length;
    digestChars += cands.reduce((s, a) => s + a.digest.length, 0);
    fullChars += cands.reduce((s, a) => s + a.content.length, 0);
    const { deps } = await scopeBrief(briefs[i], index, net);
    reports.push({ briefId: briefs[i]._id, deps });
  }
  return { reports, cost: { scanned: index.length, matched, digestTokens: Math.round(digestChars / 4), fullTokens: Math.round(fullChars / 4) } };
}

// QA: send the article text + judgment criteria; Worker scores them in one call.
export async function assessQA({ url, title, category, text, criteria }) {
  const out = await callWorker("/qa", { url, title, category, text, criteria });
  return out.criteria || [];
}
