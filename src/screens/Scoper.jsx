import React, { useState } from "react";
import { C, card, OWNERS, uid, fmtRange, sumRanges, TIME_RULES, pctOf } from "../lib/theme.js";
import { preFilter } from "../lib/kb.js";
import { runOracle as runOracleLib, oracleConfigured } from "../lib/oracle.js";
import { Icon, Chip, Cap, Stat, L } from "../components/ui.jsx";

const LIK = { High: { c: C.red, s: C.redSoft }, Medium: { c: C.amber, s: C.amberSoft }, Low: { c: "#5B6BD0", s: "#E9ECFA" } };

const BTYPE = { ER: { c: "#5B6BD0", s: "#E9ECFA", label: "ER" }, FR: { c: "#2E9E6B", s: C.greenSoft, label: "FR" }, BUG: { c: C.red, s: C.redSoft, label: "BUG" } };

export default function Scoper({ kb, net, projectNames, setView, setPendingTask }) {
  const [briefs, setBriefs] = useState([
    { _id: uid(), id: "FR-204", title: "Cancellation window 24h → 48h", type: "FR", project: "PPv5", text: "We're extending the booking cancellation window from 24 hours to 48 hours, and adding partial refunds for late cancellations." },
    { _id: uid(), id: "BUG-118", title: "Calendar sync drops recurring events", type: "BUG", project: "Sprint 17", text: "Recurring bookings synced to Google/Outlook are missing some occurrences. Fix changes how recurring events are described." },
  ]);
  const [draft, setDraft] = useState({ id: "", title: "", type: "FR", project: "", text: "" });
  const [phase, setPhase] = useState("idle"); // idle | running | done
  const [progress, setProgress] = useState("");
  const [reports, setReports] = useState([]); // [{briefId, deps:[{...,checked}]}]
  const [cost, setCost] = useState(null);
  const [error, setError] = useState("");
  const ready = kb && kb.index && kb.index.length > 0;

  const inp = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: C.ink, background: "#fff", boxSizing: "border-box" };

  function addBrief() {
    if (!draft.title.trim() || !draft.text.trim()) return;
    setBriefs((b) => [...b, { ...draft, _id: uid(), id: draft.id.trim(), title: draft.title.trim(), text: draft.text.trim(), project: draft.project || (projectNames[0] || "") }]);
    setDraft({ id: "", title: "", type: "FR", project: "", text: "" });
  }
  function removeBrief(_id) { setBriefs((b) => b.filter((x) => x._id !== _id)); setReports((r) => r.filter((x) => x.briefId !== _id)); }

  async function runOracle() {
    if (!ready || !briefs.length) return;
    if (!oracleConfigured()) { setError("Oracle not configured. Set VITE_ORACLE_URL to your Worker URL and rebuild."); return; }
    setPhase("running"); setReports([]); setCost(null); setError("");
    try {
      const { reports, cost } = await runOracleLib(briefs, kb.index, net, (i, total, br) => {
        setProgress(`Reading KB for brief ${i + 1} of ${total} \u2014 \u201c${br.title}\u201d\u2026`);
      });
      setReports(reports); setCost(cost); setPhase("done"); setProgress("");
    } catch (e) {
      setError(e.message || "The Oracle failed \u2014 check your API key."); setPhase("idle"); setProgress("");
    }
  }

  function toggleDep(briefId, slug) {
    setReports((rs) => rs.map((r) => r.briefId !== briefId ? r : { ...r, deps: r.deps.map((d) => d.slug === slug ? { ...d, checked: !d.checked } : d) }));
  }

  function createTask(br, rep) {
    const picked = rep.deps.filter((d) => d.checked);
    if (!picked.length) return;
    const total = fmtRange(sumRanges(picked.map((d) => d.estimate)));
    const scope = picked.map((d) => `- **${d.title}** (help.nexudus.com/${d.slug}) — ${fmtRange(d.estimate)}\n  ${d.recommendedChanges}`).join("\n");
    const details = `${br.text}\n\n# Content work scope\n${scope}\n\n_Total estimated: ${total} across ${picked.length} article${picked.length === 1 ? "" : "s"}._`;
    setPendingTask({
      id: br.id, name: br.title, status: "Triage", owner: OWNERS[1], project: br.project,
      start: "", end: "", estTime: total, mainUrl: picked[0] ? `https://help.nexudus.com/${picked[0].slug}` : "",
      urls: picked.map((d) => `https://help.nexudus.com/${d.slug}`), details, fromScoper: true,
    });
    setView("tracker");
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.01em", margin: 0, color: C.ink }}>Scoper</h1>
        <p style={{ fontSize: 14, color: C.muted, margin: "6px 0 0" }}>Add your change briefs, run the Oracle, and turn the affected articles into tasks.</p>
      </div>

      {!ready ? (
        <div style={{ ...card, padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>No knowledge base loaded</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Load your KB once in Settings, then refresh it whenever you like. The Oracle reads from that copy.</div>
          </div>
          <button onClick={() => setView("settings")} style={{ border: "none", background: C.orange, color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Go to Settings</button>
        </div>
      ) : (
        <>
          {/* Add brief */}
          <div style={{ ...card, padding: 18, marginBottom: 16 }}>
            <Cap>Add a brief</Cap>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <L label="Brief ID"><input style={{ ...inp, width: "100%" }} value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="e.g. FR-204" /></L>
                <L label="Type"><select style={{ ...inp, width: "100%" }} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>{Object.keys(BTYPE).map((k) => <option key={k} value={k}>{k}</option>)}</select></L>
                <L label="Project"><select style={{ ...inp, width: "100%" }} value={draft.project} onChange={(e) => setDraft({ ...draft, project: e.target.value })}><option value="">—</option>{projectNames.map((p) => <option key={p}>{p}</option>)}</select></L>
              </div>
              <L label="Title"><input style={{ ...inp, width: "100%" }} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Short name for the change" /></L>
              <L label="What's changing (plain English)"><textarea rows={3} style={{ ...inp, width: "100%", resize: "vertical", lineHeight: 1.5 }} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="Describe the change so the Oracle knows what to look for." /></L>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={addBrief} disabled={!draft.title.trim() || !draft.text.trim()} style={{ border: "none", background: (!draft.title.trim() || !draft.text.trim()) ? "#E7C3B4" : C.orange, color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "9px 16px", borderRadius: 9, cursor: (!draft.title.trim() || !draft.text.trim()) ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Icon name="plus" size={15} /> Add brief</button>
            </div>
          </div>

          {/* Queue + run */}
          {briefs.length > 0 && (
            <div style={{ ...card, padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Cap>Briefs queued · {briefs.length}</Cap>
                <span style={{ fontSize: 11.5, color: C.muted }}>KB: {kb.index.length} articles · keyword scan is free</span>
              </div>
              {briefs.map((br) => { const bt = BTYPE[br.type]; return (
                <div key={br._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${C.line}` }}>
                  <Chip c={bt.c} s={bt.s}>{br.type}</Chip>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{br.id && <span style={{ color: C.muted }}>{br.id} · </span>}{br.title}</span>
                  {br.project && <span style={{ fontSize: 11.5, color: C.muted }}>{br.project}</span>}
                  <button onClick={() => removeBrief(br._id)} title="Remove" style={{ border: "none", background: "none", cursor: "pointer", color: C.muted, display: "flex" }}><Icon name="trash" size={15} /></button>
                </div>
              ); })}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                <button onClick={runOracle} disabled={phase === "running"} style={{ border: "none", background: phase === "running" ? "#E7C3B4" : C.orange, color: "#fff", fontWeight: 700, fontSize: 14, padding: "10px 20px", borderRadius: 10, cursor: phase === "running" ? "default" : "pointer", fontFamily: "inherit" }}>
                  {phase === "running" ? "Consulting the Oracle…" : "Run Oracle 🔮"}
                </button>
              </div>
            </div>
          )}

          {error && <div style={{ ...card, padding: 16, marginBottom: 16, fontSize: 13, color: C.red }}>{error}</div>}
          {phase === "running" && <div style={{ ...card, padding: 16, marginBottom: 16, fontSize: 13, color: C.muted }}>{progress}</div>}

          {cost && (
            <div style={{ ...card, padding: 16, marginBottom: 16 }}>
              <Cap>This run</Cap>
              <div style={{ display: "flex", gap: 26, flexWrap: "wrap", marginTop: 10, fontSize: 12.5 }}>
                <Stat n={cost.scanned} l="scanned (free)" c={C.ink} />
                <Stat n={cost.matched} l="articles matched" c={C.orange} />
                <div><span style={{ fontSize: 20, fontWeight: 700, color: C.green }}>~{cost.digestTokens.toLocaleString()}</span> <span style={{ fontSize: 11.5, color: C.muted }}>tokens</span></div>
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10, background: C.greenSoft, borderRadius: 8, padding: "8px 11px" }}>Reading digests instead of full articles saved roughly <b style={{ color: C.green }}>{(cost.fullTokens - cost.digestTokens).toLocaleString()}</b> tokens this run.</div>
            </div>
          )}

          {/* Reports */}
          {reports.map((rep) => {
            const br = briefs.find((b) => b._id === rep.briefId); if (!br) return null;
            const bt = BTYPE[br.type];
            const picked = rep.deps.filter((d) => d.checked);
            const total = picked.length ? fmtRange(sumRanges(picked.map((d) => d.estimate))) : "0h";
            return (
              <div key={rep.briefId} style={{ ...card, marginBottom: 14, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.line}`, background: "#FDFBF8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Chip c={bt.c} s={bt.s}>{br.type}</Chip>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{br.id && <span style={{ color: C.muted, fontWeight: 600 }}>{br.id} · </span>}{br.title}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{br.text}</div>
                </div>
                <div style={{ padding: "6px 18px 16px" }}>
                  {rep.deps.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "12px 0" }}>No likely dependencies found for this brief.</div>}
                  {rep.deps.map((d) => { const l = LIK[d.likelihood]; return (
                    <label key={d.slug} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: `1px solid ${C.line}`, cursor: "pointer", alignItems: "flex-start" }}>
                      <input type="checkbox" checked={d.checked} onChange={() => toggleDep(rep.briefId, d.slug)} style={{ marginTop: 3, width: 16, height: 16, accentColor: C.orange, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{d.title}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}><Chip c={l.c} s={l.s}>{d.likelihood}</Chip><span style={{ fontSize: 11.5, color: C.muted }}>{fmtRange(d.estimate)}</span></span>
                        </div>
                        <a href={`https://help.nexudus.com/${d.slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 11.5, color: C.orange }}>help.nexudus.com/{d.slug}</a>
                        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{d.reasoning}</div>
                        <div style={{ fontSize: 12.5, color: C.ink, marginTop: 4, lineHeight: 1.5 }}><b>Recommended:</b> {d.recommendedChanges}</div>
                      </div>
                    </label>
                  ); })}
                  {rep.deps.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 14, borderTop: `2px solid ${C.line}`, flexWrap: "wrap", gap: 10 }}>
                      <span style={{ fontSize: 12.5, color: C.muted }}><b style={{ color: C.ink }}>{picked.length}</b> selected · total <b style={{ color: C.ink }}>{total}</b></span>
                      <button onClick={() => createTask(br, rep)} disabled={!picked.length} style={{ border: "none", background: picked.length ? C.orange : "#E7C3B4", color: "#fff", fontWeight: 700, fontSize: 13, padding: "8px 16px", borderRadius: 9, cursor: picked.length ? "pointer" : "default", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}><Icon name="plus" size={14} /> Create task</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

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
