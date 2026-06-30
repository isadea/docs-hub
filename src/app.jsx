import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, FONT, shadow, card, OWNERS, STATUSES, PCT, SS, OWNER_C, PCOLORS, uid, SORDER, byStatus, pctOf, isDone, respected, overdue, atRisk, TODAY, fmt, TIME_RULES, fmtRange, sumRanges } from "./lib/theme.js";
import { Icon, Chip, Avatar, Cap, Stat, Field, L, L2, Bar, inputStyle } from "./components/ui.jsx";
import { loadFiles, SAMPLE_KB } from "./lib/kb.js";
import { assessQA } from "./lib/oracle.js";
import Scoper from "./screens/Scoper.jsx";

/* ----------------------------------------------------------------
   Documentation Control — TRACKER (preview, sample data)
   Team members track their work; managers see workload across projects.
   Create: single task · CSV upload · handoff from the Scoper.
   Status drives %, completed-timestamp, and timeline-respected.
------------------------------------------------------------------- */


const SEED_PROJECTS = [
  { id: "p_s17", name: "Sprint 17", color: "#EC5C2B", goal: "Ship booking and access-control docs for the Q2 release.", start: "2026-04-01", end: "2026-06-15" },
  { id: "p_s18", name: "Sprint 18", color: "#5B6BD0", goal: "Member portal and access documentation for Q3.", start: "2026-06-01", end: "2026-08-01" },
  { id: "p_pp5", name: "PPv5", color: "#2E9E6B", goal: "Rework the Product Platform v5 help centre.", start: "2026-05-01", end: "2026-09-30" },
  { id: "p_mp5", name: "MPv5", color: "#C58A1B", goal: "Member Platform v5 documentation refresh.", start: "2026-05-15", end: "2026-09-30" },
  { id: "p_ne", name: "Nexudus Editions", color: "#8A6FC0", goal: "Launch content for Nexudus Editions.", start: "2026-06-15", end: "2026-07-31" },
  { id: "p_copy", name: "Copy", color: "#3B9CA8", goal: "Marketing and website copy.", start: "", end: "" },
];

/* ----------------------------- sample data ----------------------------- */
let SEED = [
  { id: "PP-101", name: "Booking rules reference", project: "PPv5", status: "Published", owner: "Isa", start: "2026-05-01", end: "2026-05-20", completedAt: "2026-05-18", details: "Reference page for all **booking rule** fields.\n- Capacity limits\n- Buffer times\n- Cancellation windows", mainUrl: "https://help.nexudus.com/docs/booking-rules", urls: [] },
  { id: "PP-102", name: "Resource booking setup guide", project: "PPv5", status: "Review", owner: "Isa", start: "2026-06-01", end: "2026-07-01", completedAt: null, details: "End-to-end task guide for setting up a bookable resource.", mainUrl: "https://help.nexudus.com/docs/resource-bookings", urls: [] },
  { id: "S17-04", name: "Calendar sync how-to", project: "Sprint 17", status: "Completed", owner: "Anne", start: "2026-05-10", end: "2026-06-05", completedAt: "2026-06-09", details: "Connecting external calendars (Google, Outlook).", mainUrl: "", urls: [] },
  { id: "S18-02", name: "Member portal overview", project: "Sprint 18", status: "Drafting", owner: "Anne", start: "2026-06-15", end: "2026-07-10", completedAt: null, details: "Concept article introducing the member portal.", mainUrl: "", urls: [] },
  { id: "MP-007", name: "Profile fields reference", project: "MPv5", status: "Stuck", heldPct: 45, owner: "Isa", start: "2026-06-01", end: "2026-06-20", completedAt: null, details: "Blocked: waiting on final field list from product.", mainUrl: "", urls: [] },
  { id: "NE-11", name: "Editions launch copy", project: "Nexudus Editions", status: "To-do", owner: "Anne", start: "2026-06-20", end: "2026-07-15", completedAt: null, details: "Marketing copy for the Editions launch.", mainUrl: "", urls: [] },
  { id: "CP-30", name: "Pricing page copy", project: "Copy", status: "Triage", owner: "Isa", start: "2026-06-25", end: "2026-07-05", completedAt: null, details: "", mainUrl: "", urls: [] },
  { id: "S17-09", name: "Access control overview", project: "Sprint 17", status: "Published", owner: "Anne", start: "2026-04-15", end: "2026-05-10", completedAt: "2026-05-09", details: "Concept overview of access control.", mainUrl: "", urls: [] },
  { id: "S18-05", name: "Troubleshooting access", project: "Sprint 18", status: "Stuck", heldPct: 70, owner: "Anne", start: "2026-05-20", end: "2026-06-22", completedAt: null, details: "Blocked on hardware test environment.", mainUrl: "", urls: [] },
  { id: "PP-110", name: "Recurring bookings", project: "PPv5", status: "Drafting", owner: "Isa", start: "2026-06-10", end: "2026-06-30", completedAt: null, details: "Task guide for setting up recurring bookings.", mainUrl: "", urls: [] },
  { id: "MP-012", name: "Billing details update", project: "MPv5", status: "Review", owner: "Isa", start: "2026-06-05", end: "2026-06-28", completedAt: null, details: "How members update billing details.", mainUrl: "", urls: [] },
  { id: "CP-31", name: "Feature announcement copy", project: "Copy", status: "Completed", owner: "Anne", start: "2026-06-01", end: "2026-06-15", completedAt: "2026-06-14", details: "Announcement copy for the June feature drop.", mainUrl: "", urls: [] },
];
SEED = SEED.map((t) => ({ _uid: uid(), ...t }));

/* ----------------------------- derived helpers ----------------------------- */
// At risk: still early (not yet Review/Completed/Published) AND under 2 days to deadline.

function mdLite(t) {
  if (!t) return "";
  let h = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return h.split("\n").map((l) => /^\s*[-*]\s+/.test(l) ? "&nbsp;&nbsp;• " + l.replace(/^\s*[-*]\s+/, "") : l).join("<br/>");
}

/* ----------------------------- CSV ----------------------------- */
function splitCSVLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else { if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch; }
  }
  out.push(cur); return out;
}
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];
  const heads = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitCSVLine(line); const o = {};
    heads.forEach((h, i) => (o[h] = (cells[i] || "").trim()));
    return o;
  });
}
function rowToTask(o) {
  const status = STATUSES.find((s) => s.toLowerCase() === (o.status || "").toLowerCase()) || "Triage";
  return {
    _uid: uid(),
    id: o.id || ("NEW-" + Math.random().toString(36).slice(2, 6)),
    name: o.name || o.task || "Untitled",
    status, owner: OWNERS.find((w) => w.toLowerCase() === (o.owner || "").toLowerCase()) || OWNERS[0],
    project: o.project || "",
    start: o.start || "", end: o.end || "", estTime: o.estTime || o.estimate || "", completedAt: (status === "Completed" || status === "Published") ? (o.completed || o.end || "") : null,
    details: o.details || "", mainUrl: o.mainUrl || o.main_url || o.url || "", urls: Array.isArray(o.urls) ? o.urls : (o.urls || "").split(/[;\s]+/).filter(Boolean),
  };
}

/* ----------------------------- atoms ----------------------------- */


/* ----------------------------- task row ----------------------------- */
function TaskRow({ t, onUpdate, open, onToggle, customFields, projectNames }) {
  const st = SS[t.status];
  const r = respected(t);
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!open) setEditing(false); }, [open]);
  const inp = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: C.ink, background: "#fff", boxSizing: "border-box" };
  const up = (patch) => onUpdate(t._uid, patch);

  const workFields = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
      <L2 label="Task details (markdown)"><textarea rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} value={t.details} onChange={(e) => up({ details: e.target.value })} placeholder="Add details…" /></L2>
      <L2 label="Main URL"><input style={inp} value={t.mainUrl} onChange={(e) => up({ mainUrl: e.target.value })} placeholder="https://…" /></L2>
      <L2 label="Full URL list (comma-separated)"><input style={inp} value={(t.urls || []).join(", ")} onChange={(e) => up({ urls: e.target.value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) })} placeholder="https://… , https://…" /></L2>
    </div>
  );

  return (
    <div style={{ borderTop: `1px solid ${C.line}` }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", flexWrap: "wrap" }}>
        <Avatar who={t.owner} />
        <div style={{ flex: "2 1 200px", minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{t.id} · {t.project}</div>
        </div>
        <Chip c={st.c} s={st.s}>{t.status}</Chip>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Bar value={pctOf(t)} color={st.c} />
          <span style={{ fontSize: 11, color: C.muted, width: 30 }}>{pctOf(t)}%</span>
        </div>
        <div style={{ fontSize: 11.5, color: overdue(t) ? C.red : C.muted, width: 78, textAlign: "right" }}>
          {overdue(t) ? "Overdue " : atRisk(t) ? "Due " : "by "}{fmt(t.end)}
        </div>
        <span style={{ color: C.muted, fontSize: 12, transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▶</span>
      </div>
      {open && (
        <div style={{ padding: "12px 16px 18px 50px", background: "#FDFBF8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted }}>{editing ? "Edit task" : "Overview"}</div>
            <button onClick={() => setEditing((e) => !e)} style={{ border: `1px solid ${editing ? C.orange : C.line}`, background: editing ? C.orangeSoft : "#fff", color: editing ? C.orange : C.muted, fontWeight: 600, fontSize: 12, padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              {editing ? "Done" : <><Icon name="pencil" size={13} /> Edit task</>}
            </button>
          </div>

          {editing ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <L2 label="Task name" flex="2 1 220px"><input style={inp} value={t.name} onChange={(e) => up({ name: e.target.value })} /></L2>
                  <L2 label="Task ID" flex="1 1 120px"><input style={inp} value={t.id} onChange={(e) => up({ id: e.target.value })} /></L2>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <L2 label="Project" flex="1 1 140px"><select style={inp} value={t.project} onChange={(e) => up({ project: e.target.value })}>{(projectNames || []).map((p) => <option key={p}>{p}</option>)}</select></L2>
                  <L2 label="Owner" flex="1 1 110px"><select style={inp} value={t.owner} onChange={(e) => up({ owner: e.target.value })}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select></L2>
                  <L2 label="Status" flex="1 1 130px"><select style={{ ...inp, color: st.c, fontWeight: 700 }} value={t.status} onChange={(e) => up({ status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></L2>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <L2 label="Start date" flex="1 1 130px"><input type="date" style={inp} value={t.start || ""} onChange={(e) => up({ start: e.target.value })} /></L2>
                  <L2 label="End date" flex="1 1 130px"><input type="date" style={inp} value={t.end || ""} onChange={(e) => up({ end: e.target.value })} /></L2>
                  <L2 label="Estimated time" flex="1 1 120px"><input style={inp} value={t.estTime || ""} onChange={(e) => up({ estTime: e.target.value })} placeholder="e.g. 6–9h" /></L2>
                </div>
                {workFields}
                {customFields && customFields.map((cf) => (
                  <L2 key={cf.id} label={cf.label}>{renderCustomInput(cf, t.custom ? t.custom[cf.id] : "", (v) => up({ custom: { ...(t.custom || {}), [cf.id]: v } }), inp)}</L2>
                ))}
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
                <Field label="Percentage (from status)"><span style={{ fontWeight: 700 }}>{pctOf(t)}%</span></Field>
                <Field label="Completed (auto)">{t.completedAt ? fmt(t.completedAt) : "—"}</Field>
                <Field label="Timeline respected">{r === null ? <span style={{ color: C.muted }}>—</span> : <Chip c={r ? C.green : C.red} s={r ? C.greenSoft : C.redSoft}>{r ? "Yes" : "No"}</Chip>}</Field>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "9px 18px", marginBottom: 14, fontSize: 12.5, color: C.muted }}>
                <Chip c={st.c} s={st.s}>{t.status}</Chip>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Bar value={pctOf(t)} color={st.c} /><span>{pctOf(t)}%</span></span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar who={t.owner} />{t.owner}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="folder" size={13} />{t.project || "—"}</span>
                <span>{fmt(t.start)} → {fmt(t.end)}</span>
                {t.estTime && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="clock" size={13} />{t.estTime}</span>}
                {t.completedAt && <span>Done {fmt(t.completedAt)}</span>}
                {r !== null && <Chip c={r ? C.green : C.red} s={r ? C.greenSoft : C.redSoft}>{r ? "On time" : "Late"}</Chip>}
              </div>
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>{workFields}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- workload view ----------------------------- */
function Workload({ tasks, projectNames }) {
  const byOwner = OWNERS.map((o) => {
    const ts = tasks.filter((t) => t.owner === o);
    return { o, active: ts.filter((t) => !isDone(t) && t.status !== "Stuck").length, stuck: ts.filter((t) => t.status === "Stuck").length, done: ts.filter(isDone).length, total: ts.length };
  });
  const byProject = projectNames.map((p) => {
    const ts = tasks.filter((t) => t.project === p);
    const avg = ts.length ? Math.round(ts.reduce((s, t) => s + pctOf(t), 0) / ts.length) : 0;
    return { p, count: ts.length, avg };
  }).filter((x) => x.count);
  const flagged = tasks.filter((t) => overdue(t) || atRisk(t) || t.status === "Stuck");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ ...card, padding: 18 }}>
        <Cap>Workload per person</Cap>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
          {byOwner.map((b) => (
            <div key={b.o} style={{ flex: "1 1 200px", border: `1px solid ${C.line}`, borderRadius: 11, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}><Avatar who={b.o} /><span style={{ fontWeight: 700, fontSize: 14 }}>{b.o}</span></div>
              <div style={{ display: "flex", gap: 16, fontSize: 12.5 }}>
                <Stat n={b.active} l="active" c={C.orange} />
                <Stat n={b.stuck} l="stuck" c={b.stuck ? C.red : C.muted} />
                <Stat n={b.done} l="done" c={C.green} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 18 }}>
        <Cap>Progress per project</Cap>
        <div style={{ marginTop: 10 }}>
          {byProject.map((b, i) => (
            <div key={b.p} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <span style={{ flex: "1 1 140px", fontSize: 13, fontWeight: 600 }}>{b.p}</span>
              <span style={{ fontSize: 11.5, color: C.muted, width: 70 }}>{b.count} task{b.count > 1 ? "s" : ""}</span>
              <div style={{ flex: 1, height: 7, background: C.line, borderRadius: 999, overflow: "hidden", maxWidth: 240 }}>
                <div style={{ height: "100%", width: `${b.avg}%`, background: C.orange }} /></div>
              <span style={{ fontSize: 12, fontWeight: 700, width: 36, textAlign: "right" }}>{b.avg}%</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 18 }}>
        <Cap>Overdue &amp; at-risk</Cap>
        <div style={{ marginTop: 6 }}>
          {flagged.length === 0 && <div style={{ fontSize: 13, color: C.muted, paddingTop: 8 }}>Nothing flagged.</div>}
          {flagged.map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <Avatar who={t.owner} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name} <span style={{ color: C.muted, fontSize: 11.5 }}>· {t.project}</span></span>
              <Chip c={t.status === "Stuck" ? C.red : overdue(t) ? C.red : C.amber} s={t.status === "Stuck" ? C.redSoft : overdue(t) ? C.redSoft : C.amberSoft}>
                {t.status === "Stuck" ? "Stuck" : overdue(t) ? "Overdue" : "Due soon"}
              </Chip>
              <span style={{ fontSize: 11.5, color: C.muted, width: 60, textAlign: "right" }}>{fmt(t.end)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- create modal ----------------------------- */
function CreateModal({ initial, customFields, projectNames, onClose, onSave }) {
  const [f, setF] = useState(() => ({ custom: {}, ...initial }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setC = (id, v) => setF((p) => ({ ...p, custom: { ...(p.custom || {}), [id]: v } }));
  const inp = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", boxSizing: "border-box", color: C.ink };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(31,32,36,.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", zIndex: 50, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 520, padding: 22 }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{initial.fromScoper ? "New task from Scoper" : "New task"}</div>
        {initial.fromScoper && <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14, background: C.orangeSoft, borderRadius: 8, padding: "8px 11px" }}>ID, project, and details were pre-filled by the Scoper. Adjust anything before saving.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
          <Two>
            <L label="Task ID"><input style={inp} value={f.id} onChange={(e) => set("id", e.target.value)} placeholder="e.g. PP-120" /></L>
            <L label="Owner"><select style={inp} value={f.owner} onChange={(e) => set("owner", e.target.value)}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select></L>
          </Two>
          <L label="Task name"><input style={inp} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Short title" /></L>
          <L label="Task details (markdown)"><textarea rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} value={f.details} onChange={(e) => set("details", e.target.value)} /></L>
          <Two>
            <L label="Project"><select style={inp} value={f.project} onChange={(e) => set("project", e.target.value)}>{(projectNames || []).map((p) => <option key={p}>{p}</option>)}</select></L>
            <L label="Status"><select style={inp} value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></L>
          </Two>
          <L label="Main URL"><input style={inp} value={f.mainUrl} onChange={(e) => set("mainUrl", e.target.value)} placeholder="https://…" /></L>
          <Two>
            <L label="Start date"><input type="date" style={inp} value={f.start} onChange={(e) => set("start", e.target.value)} /></L>
            <L label="End date"><input type="date" style={inp} value={f.end} onChange={(e) => set("end", e.target.value)} /></L>
          </Two>
        </div>
        {customFields && customFields.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, marginTop: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>Custom fields</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {customFields.map((cf) => <L key={cf.id} label={cf.label}>{renderCustomInput(cf, f.custom ? f.custom[cf.id] : "", (v) => setC(cf.id, v), inp)}</L>)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.muted, fontWeight: 600, fontSize: 13.5, padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => onSave(f)} style={{ border: "none", background: C.orange, color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "9px 18px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Add task</button>
        </div>
      </div>
    </div>
  );
}
const Two = ({ children }) => <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{React.Children.map(children, (c) => <div style={{ flex: "1 1 160px" }}>{c}</div>)}</div>;

/* ----------------------------- KB index + scoper engine ----------------------------- */
// The KB is uploaded once in Settings and turned into a lightweight INDEX in code
// (no model calls). Scoping a brief matches against that index with keyword scoring
// (also no model calls), then a single focused model pass reads only digests of the
// top candidates. This is the token-efficient path.


// Build a per-article index: title, slug, headings, and a term-frequency profile.

// Score every indexed article against a brief — pure keyword overlap, zero tokens.


// A small but realistic mock KB so the preview behaves like the real thing.


const Sum = ({ n, l, red }) => <div><span style={{ fontSize: 26, fontWeight: 700, color: red ? "#DB4A40" : "#1f2024" }}>{n}</span> <span style={{ fontSize: 12, color: "#6E6A64" }}>{l}</span></div>;
const RSec = ({ title, count, children }) => <div style={{ marginTop: 22 }}><div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: "2px solid #1f2024", paddingBottom: 5, marginBottom: 2 }}><h2 style={{ fontSize: 13, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>{title}</h2><span style={{ fontSize: 11.5, color: "#6E6A64" }}>{count}</span></div>{children}</div>;
const REmpty = () => <div style={{ fontSize: 12.5, color: "#8a857c", padding: "10px 0" }}>Nothing in this section.</div>;

function WeeklyReport({ tasks, onClose }) {
  const completed = tasks.filter(isDone).slice().sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  const todo = tasks.filter((t) => !isDone(t) && t.status !== "Stuck").slice().sort(byStatus);
  const stuck = tasks.filter((t) => t.status === "Stuck");
  const today = TODAY.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const meta = (parts) => parts.filter(Boolean).join("  ·  ");

  const Line = ({ t, mode }) => (
    <div style={{ padding: "9px 0", borderBottom: "1px solid #E8E2D8" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1f2024" }}>
          {t.mainUrl ? <a href={t.mainUrl} target="_blank" rel="noreferrer" style={{ color: "#1f2024" }}>{t.name}</a> : t.name}
          <span style={{ color: "#8a857c", fontWeight: 400 }}>  {t.id}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#6E6A64", whiteSpace: "nowrap" }}>{t.project} · {t.owner}</div>
      </div>
      <div style={{ fontSize: 11.5, color: "#6E6A64", marginTop: 3 }}>
        {mode === "done" && meta([`Completed ${fmt(t.completedAt)}`, respected(t) === null ? null : (respected(t) ? "on time" : "late"), (t.urls && t.urls.length) ? `${t.urls.length} link${t.urls.length > 1 ? "s" : ""}` : null])}
        {mode === "todo" && meta([`${t.status} · ${pctOf(t)}%`, t.end ? `due ${fmt(t.end)}${overdue(t) ? " (overdue)" : ""}` : null, (t.urls && t.urls.length) ? `${t.urls.length} link${t.urls.length > 1 ? "s" : ""}` : null])}
        {mode === "stuck" && meta([t.details ? t.details.replace(/[*`#]/g, "").replace(/\n/g, " ").slice(0, 90) : "Blocked", t.end ? `due ${fmt(t.end)}` : null])}
      </div>
    </div>
  );

  return (
    <div className="noprint-bg" style={{ position: "fixed", inset: 0, background: "rgba(31,32,36,.45)", overflowY: "auto", zIndex: 80, paddingBottom: 40 }}>
      <style>{`@media print { body *{visibility:hidden!important;} .rep,.rep *{visibility:visible!important;} .rep{position:absolute;left:0;top:0;width:100%;margin:0!important;box-shadow:none!important;border-radius:0!important;} .noprint-bg{background:#fff!important;} .noprint{display:none!important;} }`}</style>
      <div className="noprint" style={{ position: "sticky", top: 0, background: "#1f2024", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", zIndex: 2 }}>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Weekly report preview</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => window.print()} style={{ border: "none", background: "#EC5C2B", color: "#fff", fontWeight: 700, fontSize: 13, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Save as PDF</button>
          <button onClick={onClose} style={{ border: "1px solid #4a4b52", background: "transparent", color: "#fff", fontWeight: 600, fontSize: 13, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
        </div>
      </div>
      <div className="rep" style={{ maxWidth: 760, margin: "28px auto", background: "#fff", borderRadius: 6, boxShadow: "0 10px 40px rgba(0,0,0,.2)", padding: "40px 44px", color: "#1f2024", fontFamily: FONT }}>
        <div style={{ borderTop: "3px solid #EC5C2B", paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: "#EC5C2B" }}>Nexudus · Documentation</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "6px 0 2px" }}>Weekly work report</h1>
          <div style={{ fontSize: 13, color: "#6E6A64" }}>Week ending {today}</div>
        </div>
        <div style={{ display: "flex", gap: 26, margin: "22px 0 6px" }}>
          <Sum n={completed.length} l="completed" />
          <Sum n={todo.length} l="to be completed" />
          <Sum n={stuck.length} l="stuck" red={stuck.length > 0} />
        </div>
        <RSec title="Completed" count={completed.length}>{completed.length ? completed.map((t) => <Line key={t._uid} t={t} mode="done" />) : <REmpty />}</RSec>
        <RSec title="To be completed" count={todo.length}>{todo.length ? todo.map((t) => <Line key={t._uid} t={t} mode="todo" />) : <REmpty />}</RSec>
        <RSec title="Stuck" count={stuck.length}>{stuck.length ? stuck.map((t) => <Line key={t._uid} t={t} mode="stuck" />) : <REmpty />}</RSec>
        <div style={{ marginTop: 30, paddingTop: 12, borderTop: "1px solid #E8E2D8", fontSize: 10.5, color: "#8a857c" }}>Generated by Docs Hub · {TODAY.toLocaleString("en-GB")}</div>
      </div>
    </div>
  );
}

/* ----------------------------- tracker screen ----------------------------- */
function TrackerScreen({ tasks, setTasks, projects, customFields, pendingTask, setPendingTask }) {
  const projectNames = projects.map((p) => p.name);
  const [tab, setTab] = useState("tasks");
  const [owner, setOwner] = useState("all");
  const [project, setProject] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [modal, setModal] = useState(null);
  const [report, setReport] = useState(false);
  useEffect(() => {
    if (pendingTask) { setModal({ project: projectNames[0], ...pendingTask }); setPendingTask(null); }
  }, [pendingTask]);
  const [toast, setToast] = useState("");
  const fileRef = useRef();

  const shown = useMemo(() => tasks.filter((t) => (owner === "all" || t.owner === owner) && (project === "all" || t.project === project)), [tasks, owner, project]);
  const active = shown.filter((t) => !isDone(t)).sort(byStatus);
  const doneTasks = shown.filter(isDone).sort(byStatus);

  function updateTask(uidKey, patch) {
    setTasks((prev) => prev.map((t) => {
      if (t._uid !== uidKey) return t;
      const u = { ...t, ...patch };
      if (patch.status && patch.status !== t.status) {
        if (patch.status === "Completed" || patch.status === "Published") { if (!u.completedAt) u.completedAt = TODAY.toISOString().slice(0, 10); }
        else u.completedAt = null;
        if (patch.status === "Stuck" && t.status !== "Stuck") u.heldPct = pctOf(t);
      }
      return u;
    }));
  }
  function save(f) {
    const t = rowToTask(f);
    t.custom = f.custom || {};
    if (f.status === "Completed" || f.status === "Published") t.completedAt = TODAY.toISOString().slice(0, 10);
    setTasks((p) => [t, ...p]); setModal(null); flash("Task added");
  }
  function onFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => { try { const rows = parseCSV(rd.result).map((o) => { const t = rowToTask(o); if (!t.project) t.project = projectNames[0]; t.custom = {}; (customFields || []).forEach((cf) => { const k = cf.label.toLowerCase(); if (o[k] !== undefined && o[k] !== "") t.custom[cf.id] = o[k]; }); return t; }); setTasks((p) => [...rows, ...p]); flash(`Imported ${rows.length} task${rows.length === 1 ? "" : "s"}`); } catch (x) { flash("Couldn't read that CSV"); } };
    rd.readAsText(file); e.target.value = "";
  }
  function flash(m) { setToast(m); setTimeout(() => setToast(""), 2600); }

  const newBlank = { id: "", name: "", details: "", project: projectNames[0], status: "Triage", owner: OWNERS[1], start: "", end: "", mainUrl: "" };
  const fromScoper = { id: "PP-121", name: "Booking cancellation policy", details: "**Scoper suggestions:**\n- Update 'Cancellation windows' section\n- Add example for partial refunds\n- Cross-link to 'Booking rules reference'", project: "PPv5", status: "Triage", owner: OWNERS[1], start: "", end: "", mainUrl: "", fromScoper: true };

  const fbtn = (val, set, cur, label) => (
    <button onClick={() => set(val)} style={{ border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 7, fontFamily: "inherit", background: cur === val ? C.ink : "transparent", color: cur === val ? "#fff" : C.muted }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.01em", margin: 0, color: C.ink }}>Tracker</h1>
          <p style={{ fontSize: 14, color: C.muted, margin: "6px 0 0" }}>Track your work; see workload across every project.</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setReport(true)} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontWeight: 600, fontSize: 13, padding: "8px 13px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}><Icon name="report" size={15} /> Weekly report</button>
          <button onClick={() => setModal(fromScoper)} style={{ border: `1px solid ${C.orange}`, background: C.orangeSoft, color: C.orange, fontWeight: 700, fontSize: 13, padding: "8px 13px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>From Scoper</button>
          <button onClick={() => fileRef.current.click()} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontWeight: 600, fontSize: 13, padding: "8px 13px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}><Icon name="up" size={15} /> Import CSV</button>
          <button onClick={() => setModal(newBlank)} style={{ border: "none", background: C.orange, color: "#fff", fontWeight: 700, fontSize: 13, padding: "8px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Icon name="plus" size={15} /> New task</button>
          <input ref={fileRef} type="file" accept=".csv" onChange={onFile} style={{ display: "none" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "inline-flex", background: C.card, border: `1px solid ${C.line}`, borderRadius: 9, padding: 3, boxShadow: shadow }}>
          {fbtn("tasks", setTab, tab, "Tasks")}{fbtn("workload", setTab, tab, "Metrics")}
        </div>
        {tab === "tasks" && <>
          <div style={{ display: "inline-flex", background: C.card, border: `1px solid ${C.line}`, borderRadius: 9, padding: 3 }}>
            {fbtn("all", setOwner, owner, "Everyone")}{OWNERS.map((o) => <span key={o}>{fbtn(o, setOwner, owner, o)}</span>)}
          </div>
          <select value={project} onChange={(e) => setProject(e.target.value)} style={{ fontFamily: "inherit", fontSize: 12.5, padding: "8px 10px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", color: C.ink }}>
            <option value="all">All projects</option>{projectNames.map((p) => <option key={p}>{p}</option>)}
          </select>
          <span style={{ fontSize: 12.5, color: C.muted, marginLeft: "auto" }}>{shown.length} task{shown.length === 1 ? "" : "s"}</span>
        </>}
      </div>

      {tab === "tasks" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px" }}><Cap>Active</Cap><span style={{ fontSize: 12, color: C.muted }}>{active.length}</span></div>
          <div style={{ ...card, overflow: "hidden" }}>
            {active.map((t) => <TaskRow key={t._uid} t={t} open={openId === t._uid} onToggle={() => setOpenId(openId === t._uid ? null : t._uid)} onUpdate={updateTask} customFields={customFields} projectNames={projectNames} />)}
            {active.length === 0 && <div style={{ padding: 24, color: C.muted, fontSize: 13 }}>No active tasks match.</div>}
          </div>
          {doneTasks.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "24px 0 10px" }}><Cap>Completed</Cap><span style={{ fontSize: 12, color: C.muted }}>{doneTasks.length}</span></div>
              <div style={{ ...card, overflow: "hidden" }}>
                {doneTasks.map((t) => <TaskRow key={t._uid} t={t} open={openId === t._uid} onToggle={() => setOpenId(openId === t._uid ? null : t._uid)} onUpdate={updateTask} customFields={customFields} projectNames={projectNames} />)}
              </div>
            </>
          )}
        </>
      ) : <Workload tasks={tasks} projectNames={projectNames} />}

      {modal && <CreateModal initial={modal} customFields={customFields} projectNames={projectNames} onClose={() => setModal(null)} onSave={save} />}
      {report && <WeeklyReport tasks={tasks} onClose={() => setReport(false)} />}
      {toast && <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: C.ink, color: "#fff", fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: 10, zIndex: 60 }}>{toast}</div>}
    </div>
  );
}

/* ----------------------------- custom fields ----------------------------- */
function renderCustomInput(cf, value, onChange, inp) {
  const v = value === undefined ? "" : value;
  if (cf.type === "longtext") return <textarea rows={2} style={{ ...inp, width: "100%", resize: "vertical" }} value={v} onChange={(e) => onChange(e.target.value)} />;
  if (cf.type === "number") return <input type="number" style={{ ...inp, width: "100%" }} value={v} onChange={(e) => onChange(e.target.value)} />;
  if (cf.type === "date") return <input type="date" style={{ ...inp, width: "100%" }} value={v} onChange={(e) => onChange(e.target.value)} />;
  if (cf.type === "url") return <input style={{ ...inp, width: "100%" }} value={v} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />;
  if (cf.type === "yesno") return <select style={{ ...inp, width: "100%" }} value={v} onChange={(e) => onChange(e.target.value)}><option value="">—</option><option>Yes</option><option>No</option></select>;
  if (cf.type === "select") return <select style={{ ...inp, width: "100%" }} value={v} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{(cf.options || []).map((o) => <option key={o}>{o}</option>)}</select>;
  return <input style={{ ...inp, width: "100%" }} value={v} onChange={(e) => onChange(e.target.value)} />;
}

function Settings({ fields, setFields, kb, setKb }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState("");
  const TYPES = [["text", "Text"], ["longtext", "Long text"], ["number", "Number"], ["date", "Date"], ["url", "URL"], ["select", "Dropdown"], ["yesno", "Yes / No"]];
  const BUILTIN = ["Task ID", "Task name", "Task details", "Main URL", "Full URL list", "Project", "Status", "Percentage", "Owner", "Timeline", "Estimated time", "Completed", "Timeline respected"];
  const inp = { border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: C.ink, background: "#fff", boxSizing: "border-box" };
  const typeLabel = (id) => (TYPES.find((t) => t[0] === id) || ["", "Text"])[1];
  const fileRef = useRef();
  const [loading, setLoading] = useState(false);
  function finish(index) {
    setKb({ index, count: index.length, words: index.reduce((a, x) => a + x.words, 0), loadedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) });
    setLoading(false);
  }
  async function loadKB(e) {
    const files = e.target.files; e.target.value = "";
    if (!files || !files.length) return;
    setLoading(true);
    finish(await loadFiles(files));
  }
  function loadMock() { setLoading(true); setTimeout(() => finish(SAMPLE_KB), 300); }

  function add() {
    if (!label.trim()) return;
    setFields((p) => [...p, { id: "cf_" + Math.random().toString(36).slice(2, 7), label: label.trim(), type, options: type === "select" ? options.split(",").map((s) => s.trim()).filter(Boolean) : undefined }]);
    setLabel(""); setOptions(""); setType("text");
  }
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.01em", margin: 0, color: C.ink }}>Settings</h1>
        <p style={{ fontSize: 14, color: C.muted, margin: "6px 0 0" }}>Load your knowledge base and add custom fields to tasks.</p>
      </div>

      <div style={{ ...card, padding: 20, marginBottom: 18 }}>
        <Cap>Knowledge base</Cap>
        {!kb || !kb.count ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Upload your KB once (a folder of <code>.md</code> articles, plus any <code>.json</code> structure files). It's indexed locally for the Scoper — refresh it whenever you like, every couple of weeks is plenty.</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => fileRef.current.click()} disabled={loading} style={{ border: "none", background: C.orange, color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}><Icon name="up" size={15} /> {loading ? "Indexing…" : "Upload KB folder"}</button>
              <button onClick={loadMock} disabled={loading} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.muted, fontWeight: 600, fontSize: 13, padding: "9px 14px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Load sample KB</button>
            </div>
            <input ref={fileRef} type="file" multiple onChange={loadKB} style={{ display: "none" }} {...{ webkitdirectory: "", directory: "" }} />
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap", marginBottom: 14 }}>
              <Stat n={kb.count} l="articles indexed" c={C.ink} />
              <Stat n={`${(kb.words / 1000).toFixed(0)}k`} l="words" c={C.ink} />
              <div><span style={{ fontSize: 20, fontWeight: 700, color: C.green }}>Ready</span> <span style={{ fontSize: 11.5, color: C.muted }}>loaded {kb.loadedAt}</span></div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => fileRef.current.click()} disabled={loading} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontWeight: 600, fontSize: 13, padding: "8px 14px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}><Icon name="up" size={14} /> {loading ? "Indexing…" : "Refresh KB"}</button>
              <button onClick={() => setKb(null)} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.red, fontWeight: 600, fontSize: 13, padding: "8px 14px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
            </div>
            <input ref={fileRef} type="file" multiple onChange={loadKB} style={{ display: "none" }} {...{ webkitdirectory: "", directory: "" }} />
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 12 }}>Indexing happens in code with no model calls, so refreshing is free. The Scoper reads from this copy until you refresh it.</div>
          </div>
        )}
      </div>

      <div style={{ ...card, padding: 20, marginBottom: 18 }}>
        <Cap>Add a custom field</Cap>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
          <label style={{ flex: "2 1 200px" }}><div style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 5 }}>Field name</div>
            <input style={{ ...inp, width: "100%" }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Reviewer, Word count, Priority" /></label>
          <label style={{ flex: "1 1 130px" }}><div style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 5 }}>Type</div>
            <select style={{ ...inp, width: "100%" }} value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <button onClick={add} style={{ border: "none", background: C.orange, color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Add field</button>
        </div>
        {type === "select" && <div style={{ marginTop: 10 }}><div style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 5 }}>Dropdown options (comma-separated)</div>
          <input style={{ ...inp, width: "100%" }} value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Low, Medium, High" /></div>}
      </div>

      <div style={{ ...card, padding: 20, marginBottom: 18 }}>
        <Cap>Custom fields</Cap>
        {fields.length === 0 && <div style={{ fontSize: 13, color: C.muted, marginTop: 10 }}>None yet. Add one above and it shows up on every task.</div>}
        <div style={{ marginTop: fields.length ? 10 : 0 }}>
          {fields.map((cf, i) => (
            <div key={cf.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: C.ink }}>{cf.label}</span>
              <Chip c={C.muted} s="#EFEAE3">{typeLabel(cf.type)}{cf.type === "select" && cf.options ? ` · ${cf.options.length}` : ""}</Chip>
              <button onClick={() => setFields((p) => p.filter((x) => x.id !== cf.id))} title="Remove" style={{ border: "none", background: "none", cursor: "pointer", color: C.muted, display: "flex" }}><Icon name="trash" size={16} /></button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 20 }}>
        <Cap>Built-in fields</Cap>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {BUILTIN.map((b) => <span key={b} style={{ fontSize: 12, fontWeight: 600, color: C.muted, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 11px" }}>{b}</span>)}
        </div>
        <p style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>These ship with every task and can't be removed.</p>
      </div>
    </div>
  );
}

/* ----------------------------- projects page ----------------------------- */
function StatusBar({ ptasks }) {
  if (!ptasks.length) return <div style={{ height: 7, background: C.line, borderRadius: 999, width: "100%" }} />;
  return (
    <div style={{ display: "flex", height: 7, borderRadius: 999, overflow: "hidden", width: "100%", background: C.line }}>
      {STATUSES.map((s) => { const n = ptasks.filter((t) => t.status === s).length; return n ? <div key={s} style={{ flex: n, background: SS[s].c }} title={`${s}: ${n}`} /> : null; })}
    </div>
  );
}

function ProjectCard({ p, ptasks, open, onToggle, onUpdate, onRemove }) {
  const inp = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: C.ink, background: "#fff", boxSizing: "border-box" };
  const up = (patch) => onUpdate(p.id, patch);
  const avg = ptasks.length ? Math.round(ptasks.reduce((s, t) => s + pctOf(t), 0) / ptasks.length) : 0;
  const sorted = ptasks.slice().sort(byStatus);
  return (
    <div style={{ borderTop: `1px solid ${C.line}` }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer", flexWrap: "wrap" }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color || C.muted, flexShrink: 0 }} />
        <div style={{ flex: "2 1 190px", minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
          {p.goal && <div style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.goal}</div>}
        </div>
        <div style={{ flex: "1 1 120px", minWidth: 110 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.muted, marginBottom: 4 }}><span>{ptasks.length} task{ptasks.length === 1 ? "" : "s"}</span><span style={{ fontWeight: 700, color: C.ink }}>{avg}%</span></div>
          <StatusBar ptasks={ptasks} />
        </div>
        <div style={{ fontSize: 11, color: C.muted, width: 116, textAlign: "right" }}>{p.start || p.end ? `${fmt(p.start)} → ${fmt(p.end)}` : "No timeline"}</div>
        <span style={{ color: C.muted, fontSize: 12, transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▶</span>
      </div>
      {open && (
        <div style={{ padding: "6px 16px 16px 36px", background: "#FDFBF8" }}>
          {p.goal && <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.5, marginBottom: 14 }}>{p.goal}</div>}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", maxWidth: 340 }}>
            <L2 label="Start date" flex="1 1 150px"><input type="date" style={inp} value={p.start || ""} onChange={(e) => up({ start: e.target.value })} /></L2>
            <L2 label="End date" flex="1 1 150px"><input type="date" style={inp} value={p.end || ""} onChange={(e) => up({ end: e.target.value })} /></L2>
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, marginBottom: 2 }}>Tasks · {ptasks.length}</div>
            {sorted.length === 0 && <div style={{ fontSize: 12.5, color: C.muted, padding: "8px 0" }}>No tasks tagged to this project yet.</div>}
            {sorted.map((task) => (
              <div key={task._uid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.line}` }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: SS[task.status].c, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.name} <span style={{ color: C.muted, fontSize: 11 }}>{task.id}</span></span>
                <Chip c={SS[task.status].c} s={SS[task.status].s}>{task.status}</Chip>
                <span style={{ fontSize: 11.5, color: C.muted, width: 34, textAlign: "right" }}>{pctOf(task)}%</span>
                <Avatar who={task.owner} />
              </div>
            ))}
          </div>
          <button onClick={() => onRemove(p.id)} style={{ marginTop: 18, border: `1px solid ${C.line}`, background: "#fff", color: C.red, fontWeight: 600, fontSize: 12, padding: "6px 11px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}><Icon name="trash" size={14} /> Delete project</button>
        </div>
      )}
    </div>
  );
}

function Projects({ projects, setProjects, tasks }) {
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ name: "", goal: "", start: "", end: "" });
  const inp = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: C.ink, background: "#fff", boxSizing: "border-box" };
  function add() { if (!nf.name.trim()) return; setProjects((p) => [...p, { id: "p_" + Math.random().toString(36).slice(2, 7), name: nf.name.trim(), color: PCOLORS[p.length % PCOLORS.length], goal: nf.goal, start: nf.start, end: nf.end }]); setNf({ name: "", goal: "", start: "", end: "" }); setAdding(false); }
  function update(id, patch) { setProjects((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x)); }
  function remove(id) { setProjects((p) => p.filter((x) => x.id !== id)); }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.01em", margin: 0, color: C.ink }}>Projects</h1>
          <p style={{ fontSize: 14, color: C.muted, margin: "6px 0 0" }}>Create projects, set goals and timelines. They become tags you can apply to tasks.</p></div>
        <button onClick={() => setAdding((a) => !a)} style={{ border: "none", background: C.orange, color: "#fff", fontWeight: 700, fontSize: 13, padding: "8px 15px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Icon name="plus" size={15} /> New project</button>
      </div>

      {adding && (
        <div style={{ ...card, padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 540 }}>
            <L label="Project name"><input style={inp} value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="e.g. Sprint 19, APIv2 docs" /></L>
            <L label="Project goal"><textarea rows={2} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} value={nf.goal} onChange={(e) => setNf({ ...nf, goal: e.target.value })} placeholder="What this project should deliver" /></L>
            <Two>
              <L label="Start date"><input type="date" style={inp} value={nf.start} onChange={(e) => setNf({ ...nf, start: e.target.value })} /></L>
              <L label="End date"><input type="date" style={inp} value={nf.end} onChange={(e) => setNf({ ...nf, end: e.target.value })} /></L>
            </Two>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={add} style={{ border: "none", background: C.orange, color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Add project</button>
            <button onClick={() => setAdding(false)} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.muted, fontWeight: 600, fontSize: 13.5, padding: "9px 14px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ ...card, overflow: "hidden" }}>
        {projects.map((p) => <ProjectCard key={p.id} p={p} ptasks={tasks.filter((t) => t.project === p.name)} open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} onUpdate={update} onRemove={remove} />)}
        {projects.length === 0 && <div style={{ padding: 24, color: C.muted, fontSize: 13 }}>No projects yet — add one to start tagging tasks.</div>}
      </div>
    </div>
  );
}

/* ----------------------------- scoper screen ----------------------------- */

/* ----------------------------- QA Checker ----------------------------- */
// The documentation Definition of Done — weighted, category-aware rubric.
// Categories: concept / task / reference (Diataxis-style). Pass >=70, review 60-69, fail <60.
// Criteria are deterministic (machine-checkable) or judgment (model-assessed in the live version).
const QA_PASS = 70, QA_REVIEW = 60;
const QA_CRITERIA = [
  { id: "links_verified", label: "Links verified & working", type: "deterministic", w: { concept: 10, task: 10, reference: 16 } },
  { id: "visuals_present", label: "Visuals present", type: "deterministic", w: { concept: 6, task: 8, reference: 4 } },
  { id: "heading_structure", label: "Heading structure", type: "deterministic", w: { concept: 8, task: 7, reference: 10 } },
  { id: "multiple_use_cases", label: "Multiple use cases", type: "judgment", w: { concept: 8, task: 14, reference: 0 }, check: "At least two distinct use cases are documented." },
  { id: "e2e_workflow", label: "End-to-end workflow", type: "judgment", w: { concept: 4, task: 16, reference: 0 }, check: "A common scenario is documented start to finish, with no gaps." },
  { id: "edge_cases", label: "Edge cases covered", type: "judgment", w: { concept: 6, task: 10, reference: 6 }, check: "Common edge cases a reader is likely to hit are addressed." },
  { id: "concept_clarity", label: "Concept clarity", type: "judgment", w: { concept: 18, task: 4, reference: 4 }, check: "The underlying idea is explained clearly — what it is and why it matters." },
  { id: "completeness_of_reference", label: "Reference completeness", type: "judgment", w: { concept: 0, task: 0, reference: 18 }, check: "Every relevant parameter, field, or option is documented." },
  { id: "visuals_current", label: "Visuals current", type: "judgment", w: { concept: 6, task: 6, reference: 6 }, protoNA: true, check: "Screenshots reflect current product behaviour." },
];
const QA_CATS = [
  { id: "concept", label: "Concept", desc: "Explains an idea — what it is, why it matters." },
  { id: "task", label: "Task", desc: "Walks the reader through doing something." },
  { id: "reference", label: "Reference", desc: "Exhaustive lookup of fields, parameters, options." },
];

// Score one criterion for a category, redistributing weight when criteria are N/A.
function qaScore(category, results) {
  // results: { [criterionId]: { score: 0|0.5|1, na?: bool } }
  const active = QA_CRITERIA.filter((c) => {
    const r = results[c.id];
    if (c.w[category] === 0) return false;
    if (r && r.na) return false;
    return true;
  });
  const totalW = active.reduce((s, c) => s + c.w[category], 0) || 1;
  let earned = 0;
  const rows = active.map((c) => {
    const norm = (c.w[category] / totalW) * 100; // redistributed to /100
    const sc = results[c.id] ? results[c.id].score : 0;
    earned += norm * sc;
    return { ...c, norm: Math.round(norm * 10) / 10, score: sc, points: Math.round(norm * sc * 10) / 10 };
  });
  return { total: Math.round(earned), rows };
}
const qaVerdict = (t) => t >= QA_PASS ? { label: "Pass", c: C.green, s: C.greenSoft } : t >= QA_REVIEW ? { label: "Review", c: C.amber, s: C.amberSoft } : { label: "Fail", c: C.red, s: C.redSoft };

// A sample scored article so the screen demonstrates a real result.
const QA_SAMPLE = {
  url: "https://help.nexudus.com/docs/resource-bookings",
  title: "Set up a bookable resource",
  category: "task",
  results: {
    links_verified: { score: 1 },
    visuals_present: { score: 1 },
    heading_structure: { score: 1 },
    multiple_use_cases: { score: 0.5 },
    e2e_workflow: { score: 1 },
    edge_cases: { score: 0.5 },
    concept_clarity: { score: 1 },
    completeness_of_reference: { score: 1 },
    visuals_current: { na: true, score: 0 },
  },
  detail: {
    links_verified: "12 links checked, all resolve (200). 1 in-page anchor matches a heading.",
    visuals_present: "4 screenshots found across the workflow.",
    heading_structure: "Logical H2/H3 nesting, no skipped levels.",
    multiple_use_cases: "One use case is thorough; a second (recurring resources) is only mentioned.",
    e2e_workflow: "Create → price → publish is documented start to finish.",
    edge_cases: "Covers double-booking; missing what happens at capacity limits.",
    concept_clarity: "Clearly frames what a bookable resource is before the steps.",
    completeness_of_reference: "Pricing and availability fields are all listed.",
    visuals_current: "Not auto-checkable — needs image analysis in the live version.",
  },
};

function QAChecker({ setView }) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | scoring | done
  const [cat, setCat] = useState("task");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function run() {
    if (!url.trim()) return;
    setPhase("scoring"); setData(null); setError("");
    try {
      // Deterministic checks + judgment happen in the Worker (fetches the article,
      // runs link/heading/visual checks, scores judgment criteria in one Claude call).
      const judgment = QA_CRITERIA.filter((c) => c.type === "judgment" && !c.protoNA).map((c) => ({ id: c.id, check: c.check }));
      const out = await assessQA({ url: url.trim(), category: cat, criteria: judgment });
      if (out.error) throw new Error(out.error);
      // Merge Worker results into the rubric's results shape.
      const results = {};
      Object.entries(out.deterministic || {}).forEach(([k, v]) => (results[k] = { score: v }));
      (out.criteria || []).forEach((c) => (results[c.id] = { score: c.score }));
      QA_CRITERIA.forEach((c) => { if (c.protoNA) results[c.id] = { na: true, score: 0 }; if (!results[c.id]) results[c.id] = { score: 0 }; });
      const detail = { ...(out.detail || {}) };
      (out.criteria || []).forEach((c) => { if (c.finding) detail[c.id] = c.finding; });
      setData({ url: url.trim(), title: out.title || url.trim(), category: cat, results, detail });
      setPhase("done");
    } catch (e) { setError(e.message || "QA failed."); setPhase("idle"); }
  }
  function loadSample() { setUrl(QA_SAMPLE.url); setError(""); setPhase("scoring"); setData(null); setTimeout(() => { setCat(QA_SAMPLE.category); setData({ ...QA_SAMPLE }); setPhase("done"); }, 600); }

  const scored = data ? qaScore(cat, data.results) : null;
  const verdict = scored ? qaVerdict(scored.total) : null;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.01em", margin: 0, color: C.ink }}>QA Checker</h1>
        <p style={{ fontSize: 14, color: C.muted, margin: "6px 0 0" }}>Score an article against the documentation Definition of Done. Pass {QA_PASS}+, review {QA_REVIEW}–{QA_PASS - 1}, fail below {QA_REVIEW}.</p>
      </div>

      <div style={{ ...card, padding: 18, marginBottom: 16 }}>
        <Cap>Article URL</Cap>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://help.nexudus.com/docs/…" style={{ flex: "1 1 280px", border: `1px solid ${C.line}`, borderRadius: 9, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", color: C.ink, boxSizing: "border-box" }} />
          <button onClick={run} disabled={phase === "scoring"} style={{ border: "none", background: phase === "scoring" ? "#E7C3B4" : C.orange, color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "10px 18px", borderRadius: 9, cursor: phase === "scoring" ? "default" : "pointer", fontFamily: "inherit" }}>{phase === "scoring" ? "Scoring…" : "Score article"}</button>
          <button onClick={loadSample} disabled={phase === "scoring"} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.muted, fontWeight: 600, fontSize: 13, padding: "10px 14px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Try a sample</button>
        </div>
      </div>

      {error && <div style={{ ...card, padding: 16, marginBottom: 16, fontSize: 13, color: C.red }}>{error}</div>}
      {phase === "scoring" && <div style={{ ...card, padding: 16, marginBottom: 16, fontSize: 13, color: C.muted }}>Fetching article, verifying links, checking structure, assessing against the rubric…</div>}

      {data && scored && (
        <>
          {/* Verdict header */}
          <div style={{ ...card, padding: 20, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>{data.title}</div>
                <a href={data.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.orange }}>{data.url}</a>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: verdict.c, lineHeight: 1 }}>{scored.total}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>/ 100</div>
                </div>
                <Chip c={verdict.c} s={verdict.s}>{verdict.label}</Chip>
              </div>
            </div>
            {/* Category selector */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>Scored as <b style={{ color: C.ink }}>{QA_CATS.find((c) => c.id === cat).label}</b> — the rubric reweights by type. Change if the model mis-detected:</div>
              <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 9, padding: 3 }}>
                {QA_CATS.map((c) => <button key={c.id} onClick={() => setCat(c.id)} title={c.desc} style={{ border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, padding: "6px 13px", borderRadius: 7, fontFamily: "inherit", background: cat === c.id ? C.ink : "transparent", color: cat === c.id ? "#fff" : C.muted }}>{c.label}</button>)}
              </div>
            </div>
          </div>

          {/* Criteria breakdown */}
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between" }}>
              <Cap>Breakdown</Cap><span style={{ fontSize: 11.5, color: C.muted }}>weight redistributes when criteria are N/A</span>
            </div>
            {scored.rows.map((r) => {
              const full = r.score >= 1, partial = r.score > 0 && r.score < 1;
              const dotC = full ? C.green : partial ? C.amber : C.red;
              return (
                <div key={r.id} style={{ display: "flex", gap: 12, padding: "12px 18px", borderTop: `1px solid ${C.line}`, alignItems: "flex-start" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: dotC, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{r.label} <span style={{ fontSize: 10.5, fontWeight: 700, color: r.type === "deterministic" ? "#5B6BD0" : "#8A6FC0", background: r.type === "deterministic" ? "#E9ECFA" : "#EFEAF7", padding: "1px 7px", borderRadius: 999, marginLeft: 4 }}>{r.type === "deterministic" ? "auto" : "judgment"}</span></span>
                      <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>{r.points} / {r.norm} pts {partial && <span style={{ color: C.amber, fontWeight: 700 }}>· partial</span>}</span>
                    </div>
                    {data.detail[r.id] && <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>{data.detail[r.id]}</div>}
                  </div>
                </div>
              );
            })}
            {QA_CRITERIA.filter((c) => (data.results[c.id] && data.results[c.id].na) || c.w[cat] === 0).map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 12, padding: "10px 18px", borderTop: `1px solid ${C.line}`, alignItems: "center", opacity: .6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: C.line, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.muted, flex: 1 }}>{c.label}</span>
                <span style={{ fontSize: 11.5, color: C.muted }}>{c.w[cat] === 0 ? "n/a for this type" : "not applicable"}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 12 }}>Deterministic checks (links, visuals, headings) run in code. Judgment criteria are assessed by the model against the article text in the live version.</div>
        </>
      )}
    </div>
  );
}

/* ----------------------------- dashboard ----------------------------- */
function Dashboard({ tasks, projects, setView }) {
  const projectNames = projects.map((p) => p.name);
  const [owner, setOwner] = useState("all");
  const [project, setProject] = useState("all");
  const [status, setStatus] = useState("all"); // all | active | notdone | <a specific status>
  const [dateMode, setDateMode] = useState("due"); // due | completed
  const [preset, setPreset] = useState("all"); // all | overdue | week | month
  const [focus, setFocus] = useState("all"); // all | active | done | overdue | atrisk | stuck
  const [openTask, setOpenTask] = useState(null);

  const focusMatch = (t) => {
    if (focus === "all") return true;
    if (focus === "active") return !isDone(t) && t.status !== "Stuck";
    if (focus === "done") return isDone(t);
    if (focus === "overdue") return overdue(t);
    if (focus === "atrisk") return atRisk(t);
    if (focus === "stuck") return t.status === "Stuck";
    return true;
  };

  const statusMatch = (t) => {
    if (status === "all") return true;
    if (status === "active") return !isDone(t) && t.status !== "Stuck";
    if (status === "notdone") return !isDone(t);
    return t.status === status;
  };

  const inDateRange = (t) => {
    const d = dateMode === "due" ? t.end : t.completedAt;
    if (preset === "all") return true;
    if (!d) return false;
    const date = new Date(d), now = TODAY;
    if (preset === "overdue") return dateMode === "due" ? (!isDone(t) && date < now) : false;
    const days = (date - now) / 86400000;
    if (preset === "week") return Math.abs(days) <= 7 || (days >= -7 && days <= 7);
    if (preset === "month") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    return true;
  };

  const shown = useMemo(() => tasks.filter((t) =>
    (owner === "all" || t.owner === owner) &&
    (project === "all" || t.project === project) &&
    statusMatch(t) &&
    focusMatch(t) &&
    inDateRange(t)
  ), [tasks, owner, project, status, dateMode, preset, focus]);

  // Metrics use the filtered set WITHOUT the tile focus, so tile counts stay true
  // after you click one (clicking a tile filters the list, not the metric).
  const scoped = useMemo(() => tasks.filter((t) =>
    (owner === "all" || t.owner === owner) &&
    (project === "all" || t.project === project) &&
    statusMatch(t) &&
    inDateRange(t)
  ), [tasks, owner, project, status, dateMode, preset]);

  const m = useMemo(() => {
    const active = scoped.filter((t) => !isDone(t) && t.status !== "Stuck");
    const done = scoped.filter(isDone);
    const overdueN = scoped.filter(overdue).length;
    const atRiskN = scoped.filter(atRisk).length;
    const stuckN = scoped.filter((t) => t.status === "Stuck").length;
    const onTime = done.filter((t) => respected(t) === true).length;
    const onTimeRate = done.length ? Math.round((onTime / done.length) * 100) : null;
    const byPerson = OWNERS.map((o) => ({ o, n: scoped.filter((t) => t.owner === o && !isDone(t)).length }));
    return { active: active.length, done: done.length, overdueN, atRiskN, stuckN, onTimeRate, byPerson };
  }, [scoped]);

  const toggleStatus = null;
  const clear = () => { setOwner("all"); setProject("all"); setStatus("all"); setPreset("all"); setDateMode("due"); setFocus("all"); };
  const filtered = owner !== "all" || project !== "all" || status !== "all" || preset !== "all" || focus !== "all";

  const Metric = ({ id, n, label, c, soft, accent }) => {
    const on = focus === id;
    const selBg = soft || (accent ? accent + "1A" : C.orangeSoft); // light tint, never black
    return (
      <div onClick={() => setFocus(on ? "all" : id)} style={{ ...card, padding: "11px 12px", flex: "1 1 0", minWidth: 0, cursor: "pointer", background: on ? selBg : (soft || C.card), borderColor: on ? (accent || C.orange) : (soft ? "transparent" : C.line), position: "relative", overflow: "hidden", transition: "all .15s", boxShadow: on ? `0 0 0 2px ${(accent || C.orange)}33` : card.boxShadow }}>
        {accent && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: accent }} />}
        <div style={{ fontSize: 23, fontWeight: 800, color: c || C.ink, lineHeight: 1, paddingLeft: accent ? 6 : 0 }}>{n}</div>
        <div style={{ fontSize: 11, color: soft ? c : C.muted, marginTop: 4, fontWeight: 700, paddingLeft: accent ? 6 : 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      </div>
    );
  };
  const sel = { fontFamily: "inherit", fontSize: 12.5, padding: "7px 10px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", color: C.ink };
  const FilterSelect = ({ label, value, onChange, options }) => (
    <label style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...sel, fontWeight: 600 }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.01em", margin: 0, color: C.ink }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: C.muted, margin: "6px 0 0" }}>Team health at a glance{filtered ? " — filtered view" : ""}, and every task in one filterable list.</p>
      </div>

      {/* Health strip — one line, click a tile to filter the list to it. */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, overflowX: "auto" }}>
        <Metric id="active" n={m.active} label="Active" c={C.ink} accent={C.orange} />
        <Metric id="done" n={m.done} label="Completed" c={C.green} accent={C.green} />
        <Metric id="ontime" n={m.onTimeRate === null ? "—" : `${m.onTimeRate}%`} label="On-time" c={C.ink} accent="#5B6BD0" />
        <Metric id="overdue" n={m.overdueN} label="Overdue" c={m.overdueN ? C.red : C.muted} soft={m.overdueN ? C.redSoft : null} accent={m.overdueN ? C.red : null} />
        <Metric id="atrisk" n={m.atRiskN} label="At risk <2d" c={m.atRiskN ? C.amber : C.muted} soft={m.atRiskN ? C.amberSoft : null} accent={m.atRiskN ? C.amber : null} />
        <Metric id="stuck" n={m.stuckN} label="Stuck" c={m.stuckN ? C.red : C.muted} soft={m.stuckN ? C.redSoft : null} accent={m.stuckN ? C.red : null} />
      </div>

      {/* Per-person workload */}
      <div style={{ ...card, padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <Cap>Workload</Cap>
        {m.byPerson.map((b) => (
          <span key={b.o} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><Avatar who={b.o} /><b>{b.n}</b> <span style={{ color: C.muted }}>active</span></span>
        ))}
      </div>

      {/* Filter bar — all dropdowns, one clean row */}
      <div style={{ ...card, padding: 14, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <FilterSelect label="Person" value={owner} onChange={setOwner} options={[["all", "Everyone"], ...OWNERS.map((o) => [o, o])]} />
        <FilterSelect label="Project" value={project} onChange={setProject} options={[["all", "All projects"], ...projectNames.map((p) => [p, p])]} />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={[["all", "All statuses"], ["active", "Active only"], ["notdone", "Not done"], ...STATUSES.map((s) => [s, s])]} />
        <FilterSelect label="Date" value={dateMode} onChange={(v) => { setDateMode(v); if (v === "completed" && preset === "overdue") setPreset("all"); }} options={[["due", "By due date"], ["completed", "By completed date"]]} />
        <FilterSelect label="When" value={preset} onChange={setPreset} options={dateMode === "completed" ? [["all", "Any time"], ["week", "This week"], ["month", "This month"]] : [["all", "Any time"], ["overdue", "Overdue"], ["week", "This week"], ["month", "This month"]]} />
        {filtered && <button onClick={clear} style={{ marginLeft: "auto", border: "none", background: "none", color: C.orange, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Clear filters</button>}
      </div>

      {/* Task list */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Cap>Tasks</Cap><span style={{ fontSize: 12, color: C.muted }}>{shown.length} shown</span>
        </div>
        {shown.slice().sort(byStatus).map((t) => (
          <div key={t._uid} onClick={() => setOpenTask(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: `1px solid ${C.line}`, flexWrap: "wrap", cursor: "pointer" }}>
            <Avatar who={t.owner} />
            <div style={{ flex: "2 1 200px", minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{t.id} · {t.project}</div>
            </div>
            <Chip c={SS[t.status].c} s={SS[t.status].s}>{t.status}</Chip>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Bar value={pctOf(t)} color={SS[t.status].c} /><span style={{ fontSize: 11, color: C.muted, width: 30 }}>{pctOf(t)}%</span></div>
            <div style={{ fontSize: 11.5, color: overdue(t) ? C.red : C.muted, width: 92, textAlign: "right" }}>{dateMode === "completed" ? (t.completedAt ? `done ${fmt(t.completedAt)}` : "—") : `${overdue(t) ? "overdue " : "by "}${fmt(t.end)}`}</div>
          </div>
        ))}
        {shown.length === 0 && <div style={{ padding: 24, color: C.muted, fontSize: 13 }}>No tasks match these filters.</div>}
      </div>
      <div style={{ marginTop: 12, textAlign: "right" }}>
        <button onClick={() => setView("tracker")} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontWeight: 600, fontSize: 12.5, padding: "8px 14px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Open Tracker →</button>
      </div>

      {openTask && <TaskOverview t={openTask} onClose={() => setOpenTask(null)} />}
    </div>
  );
}

function TaskOverview({ t, onClose }) {
  const links = [t.mainUrl, ...(t.urls || [])].filter(Boolean).filter((u, i, a) => a.indexOf(u) === i);
  // Pull the "Content work scope" section out of details if present.
  const scopeMatch = (t.details || "").match(/#\s*Content work scope([\s\S]*)/i);
  const scope = scopeMatch ? scopeMatch[1].trim() : "";
  const intro = scopeMatch ? t.details.slice(0, scopeMatch.index).trim() : (t.details || "").trim();
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(31,32,36,.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "48px 16px", zIndex: 60, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 520, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{t.name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t.id} · {t.project}</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, color: C.muted, cursor: "pointer", lineHeight: 1, fontFamily: "inherit" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: "10px 18px", flexWrap: "wrap", alignItems: "center", marginTop: 14, fontSize: 12.5, color: C.muted }}>
          <Chip c={SS[t.status].c} s={SS[t.status].s}>{t.status}</Chip>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar who={t.owner} />{t.owner}</span>
          <span>{pctOf(t)}%</span>
          {t.estTime && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="clock" size={13} />{t.estTime}</span>}
          <span>{fmt(t.start)} → {fmt(t.end)}</span>
        </div>

        {intro && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.muted, marginBottom: 5 }}>Details</div>
            <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{intro}</div>
          </div>
        )}

        {scope && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.muted, marginBottom: 5 }}>Content work scope</div>
            <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.6, whiteSpace: "pre-wrap", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px" }}>{scope}</div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.muted, marginBottom: 7 }}>Links ({links.length})</div>
          {links.length === 0 && <div style={{ fontSize: 12.5, color: C.muted }}>No links on this task yet.</div>}
          {links.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 12.5, color: C.orange, padding: "4px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.replace(/^https?:\/\//, "")}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- shell ----------------------------- */
export default function App() {
  const [view, setView] = useState("home");
  const [customFields, setCustomFields] = useState([]);
  const [tasks, setTasks] = useState(SEED);
  const [projects, setProjects] = useState(SEED_PROJECTS);
  const [kb, setKb] = useState(null);
  const [pendingTask, setPendingTask] = useState(null);
  useEffect(() => {
    const id = "parkinsans-font";
    if (!document.getElementById(id)) { const l = document.createElement("link"); l.id = id; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Parkinsans:wght@400;500;600;700;800&display=swap"; document.head.appendChild(l); }
  }, []);
  const NAV = [["home", "Dashboard", "home"], ["qa", "QA Checker", "qa"], ["tracker", "Tracker", "tracker"], ["projects", "Projects", "folder"], ["scoper", "Scoper", "scoper"]];
  return (
    <div style={{ display: "flex", minHeight: "100%", fontFamily: FONT, color: C.ink, background: C.bg }}>
      <aside style={{ width: 198, flexShrink: 0, background: C.side, padding: "20px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px 18px" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: C.orange, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>D</div>
          <div style={{ lineHeight: 1.1 }}><div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Docs Hub</div><div style={{ color: C.sideMuted, fontSize: 10.5 }}>Nexudus</div></div>
        </div>
        {NAV.map(([id, label, icon]) => {
          const on = view === id;
          return <button key={id} onClick={() => setView(id)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", cursor: "pointer", border: "none", borderRadius: 9, padding: "10px 11px", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, background: on ? "rgba(236,92,43,.16)" : "transparent", color: on ? C.orange : C.sideText }}><Icon name={icon} /> {label}</button>;
        })}
        <div style={{ marginTop: "auto", borderTop: `1px solid ${C.sideLine}`, paddingTop: 8 }}>
          <button onClick={() => setView("settings")} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", cursor: "pointer", border: "none", borderRadius: 9, padding: "10px 11px", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, background: view === "settings" ? "rgba(236,92,43,.16)" : "transparent", color: view === "settings" ? C.orange : C.sideText }}><Icon name="gear" /> Settings</button>
          <div style={{ color: C.sideMuted, fontSize: 10.5, padding: "8px 10px 0" }}>Key held server-side</div>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: "32px 30px 50px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          {view === "tracker" ? <TrackerScreen tasks={tasks} setTasks={setTasks} projects={projects} customFields={customFields} pendingTask={pendingTask} setPendingTask={setPendingTask} />
            : view === "home" ? <Dashboard tasks={tasks} projects={projects} setView={setView} />
            : view === "qa" ? <QAChecker setView={setView} />
            : view === "projects" ? <Projects projects={projects} setProjects={setProjects} tasks={tasks} />
            : view === "scoper" ? <Scoper kb={kb} net={24} projectNames={projects.map((p) => p.name)} setView={setView} setPendingTask={setPendingTask} />
            : view === "settings" ? <Settings fields={customFields} setFields={setCustomFields} kb={kb} setKb={setKb} />
            : (
            <div style={{ ...card, padding: 30, textAlign: "center", color: C.muted, fontSize: 14, marginTop: 20 }}>
              The <b style={{ color: C.ink }}>Dashboard</b> is the calm home that pulls signals from every tool together — we'll build it out next. Try the Tracker, Projects, QA Checker, and Scoper from the sidebar.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
