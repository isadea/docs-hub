// Nexudus Docs Hub design tokens (orange on charcoal, Parkinsans).
export const C = {
  orange: "#EC5C2B", orangeSoft: "#FBEAE0",
  side: "#1F2024", sideLine: "#33343A", sideText: "#B7B3AC", sideMuted: "#7C7A74",
  ink: "#26272B", muted: "#6E6A64",
  bg: "#FAF7F3", card: "#FFFFFF", line: "#ECE7E0",
  green: "#2E9E6B", greenSoft: "#E5F3EC",
  amber: "#C58A1B", amberSoft: "#F7EFDC",
  red: "#DB4A40", redSoft: "#FBE8E6",
};
export const FONT = "'Parkinsans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const shadow = "0 1px 2px rgba(31,32,36,.04), 0 8px 22px rgba(31,32,36,.05)";
export const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: shadow };

export const OWNERS = ["Anne", "Isa"];
export const STATUSES = ["Triage", "To-do", "Drafting", "Review", "Completed", "Published", "Stuck"];
export const PCT = { "Triage": 0, "To-do": 15, "Drafting": 45, "Review": 70, "Completed": 90, "Published": 100 };
export const SS = {
  "Triage": { c: "#6E6A64", s: "#EFEAE3" }, "To-do": { c: "#5B6BD0", s: "#E9ECFA" },
  "Drafting": { c: "#C58A1B", s: "#F7EFDC" }, "Review": { c: "#8A6FC0", s: "#EFEAF7" },
  "Completed": { c: "#2E9E6B", s: "#E5F3EC" }, "Published": { c: "#1F7A53", s: "#DCEFE6" },
  "Stuck": { c: "#DB4A40", s: "#FBE8E6" },
};
export const OWNER_C = { Anne: "#5B6BD0", Isa: "#8A6FC0" };
export const PCOLORS = ["#EC5C2B", "#5B6BD0", "#2E9E6B", "#C58A1B", "#8A6FC0", "#3B9CA8", "#D6694F", "#B5546F"];
export const uid = () => Math.random().toString(36).slice(2, 9);

export const SORDER = {}; STATUSES.forEach((s, i) => (SORDER[s] = i));
export const byStatus = (a, b) => (SORDER[a.status] - SORDER[b.status]) || ((a.end || "9999") < (b.end || "9999") ? -1 : 1);
export const pctOf = (t) => (t.status === "Stuck" ? (t.heldPct || 0) : PCT[t.status]);
export const isDone = (t) => t.status === "Completed" || t.status === "Published";
export const respected = (t) => (t.completedAt && t.end ? (new Date(t.completedAt) <= new Date(t.end)) : null);
export const fmt = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";

// Fixed time rules (hours, as ranges): text update 2-3h, image update 1h.
export const TIME_RULES = { text: [2, 3], image: [1, 1] };
export const fmtRange = ([lo, hi]) => lo === hi ? `${lo}h` : `${lo}\u2013${hi}h`;
export const sumRanges = (ranges) => ranges.reduce(([lo, hi], [a, b]) => [lo + a, hi + b], [0, 0]);

// "Today" anchors overdue/at-risk. Uses the real current date in the running app.
export const TODAY = new Date();
export const overdue = (t) => !isDone(t) && t.end && new Date(t.end) < TODAY;
export const atRisk = (t) => { if (isDone(t) || overdue(t)) return false; if (!t.end) return false; const d = (new Date(t.end) - TODAY) / 86400000; return d >= 0 && d <= 7; };
