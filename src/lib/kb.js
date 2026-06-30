// ------------------------------------------------------------------
// Knowledge base: load uploaded files, build a token-free local index,
// and run a balanced keyword pre-filter. No model calls happen here.
// ------------------------------------------------------------------

const STOP = new Set("the a an of to and or for in on at is are be with by from as it this that update add remove change new set how do does your you our we i".split(" "));
export const tokenize = (s) => (s || "").toLowerCase().match(/[a-z0-9]+/g) || [];
export const terms = (s) => tokenize(s).filter((w) => w.length > 2 && !STOP.has(w));

// Turn a markdown article into a structured record.
export function parseArticle(name, path, content) {
  const title = (content.match(/^#\s+(.+)$/m) || [, name.replace(/\.md$/, "")])[1].trim();
  const headings = (content.match(/^#{1,4}\s+.+$/gm) || []).map((h) => h.replace(/^#+\s+/, "").trim());
  return { title, slug: name.replace(/\.md$/, ""), path, words: tokenize(content).length, headings, content };
}

// Build a per-article term-frequency profile (titles + headings weighted).
export function buildIndex(articles) {
  return articles.map((a) => {
    const profile = {};
    terms(a.title).forEach((t) => { profile[t] = (profile[t] || 0) + 4; });
    a.headings.forEach((h) => terms(h).forEach((t) => { profile[t] = (profile[t] || 0) + 3; }));
    terms(a.content).forEach((t) => { profile[t] = (profile[t] || 0) + 1; });
    // Keep a heading-level digest so the model can read cheaply.
    const digest = `# ${a.title}\n${a.headings.map((h) => `- ${h}`).join("\n")}`;
    return { slug: a.slug, title: a.title, path: a.path, words: a.words, headings: a.headings, profile, digest, content: a.content };
  });
}

// Read a FileList (folder upload) into indexed articles.
export async function loadFiles(fileList) {
  const files = Array.from(fileList).filter((f) => f.name.endsWith(".md"));
  const articles = [];
  for (const f of files) {
    const content = await f.text();
    articles.push(parseArticle(f.name, f.webkitRelativePath || f.name, content));
  }
  return buildIndex(articles);
}

// Balanced keyword pre-filter: top N by score plus near-ties past the cutoff,
// so loosely-worded articles aren't dropped. Pure scoring, zero tokens.
export function preFilter(text, index, net = 24) {
  const bterms = [...new Set(terms(text))];
  const scored = index.map((art) => {
    let score = 0;
    bterms.forEach((t) => { if (art.profile[t]) score += art.profile[t]; });
    bterms.forEach((t) => {
      if (art.title.toLowerCase().includes(t)) score += 6;
      art.headings.forEach((h) => { if (h.toLowerCase().includes(t)) score += 3; });
    });
    return { art, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);

  const top = scored.slice(0, net);
  const cutoff = top.length ? top[top.length - 1].score : 0;
  const widened = scored.slice(net).filter((x) => x.score >= cutoff * 0.6).slice(0, Math.ceil(net / 2));
  return [...top, ...widened].map((x) => ({ ...x.art, _score: x.score }));
}

// Optional tiny sample KB for demos (real use uploads a folder).
export const SAMPLE_KB = [
  { title: "Booking rules and policies", slug: "booking-rules", path: "bookings/booking-rules.md", words: 1400, headings: ["Cancellation windows", "Capacity limits", "Buffer times"], content: "# Booking rules\n## Cancellation windows\n## Capacity limits\n## Buffer times" },
  { title: "Cancellation and refunds", slug: "cancellation-refunds", path: "bookings/cancellation-refunds.md", words: 1100, headings: ["Refund windows", "Partial refunds"], content: "# Cancellation and refunds\n## Refund windows\n## Partial refunds" },
  { title: "Recurring bookings", slug: "recurring-bookings", path: "bookings/recurring-bookings.md", words: 720, headings: ["Weekly and monthly patterns", "Editing a series"], content: "# Recurring bookings\n## Weekly and monthly patterns\n## Editing a series" },
  { title: "Calendar sync (Google, Outlook)", slug: "calendar-sync", path: "integrations/calendar-sync.md", words: 540, headings: ["Connecting Google Calendar", "Connecting Outlook"], content: "# Calendar sync\n## Connecting Google Calendar\n## Connecting Outlook" },
  { title: "Access control overview", slug: "access-control", path: "access/access-control.md", words: 1500, headings: ["Door access", "Access groups"], content: "# Access control\n## Door access\n## Access groups" },
].map((a) => { const profile = {}; const T=(s)=>(s.toLowerCase().match(/[a-z0-9]+/g)||[]); T(a.title).forEach(t=>profile[t]=(profile[t]||0)+4); a.headings.forEach(h=>T(h).forEach(t=>profile[t]=(profile[t]||0)+3)); T(a.content).forEach(t=>profile[t]=(profile[t]||0)+1); return { ...a, profile, digest: `# ${a.title}\n${a.headings.map(h=>`- ${h}`).join("\n")}` }; });
