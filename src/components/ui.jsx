import React from "react";
import { C, OWNER_C, pctOf } from "../lib/theme.js";

export function Icon({ name, size = 17 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    home: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    qa: <><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>,
    tracker: <><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></>,
    scoper: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    up: <path d="M12 19V5M5 12l7-7 7 7" />,
    report: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M8 13h8M8 17h6" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
    trash: <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />,
    pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg {...p}>{paths[name] || null}</svg>;
}

export const Chip = ({ c, s, children }) => <span style={{ fontSize: 11, fontWeight: 700, color: c, background: s, padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{children}</span>;
export const Avatar = ({ who }) => <span title={who} style={{ width: 24, height: 24, borderRadius: 999, background: (OWNER_C[who] || C.muted) + "22", color: OWNER_C[who] || C.muted, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{(who || "?")[0]}</span>;
export const Cap = ({ children }) => <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted }}>{children}</div>;
export const Stat = ({ n, l, c }) => <div><span style={{ fontSize: 20, fontWeight: 700, color: c }}>{n}</span> <span style={{ fontSize: 11.5, color: C.muted }}>{l}</span></div>;
export const Field = ({ label, children }) => <div><div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700, marginBottom: 4 }}>{label}</div><div style={{ color: C.ink }}>{children}</div></div>;
export const L = ({ label, children, flex }) => <label style={{ display: "block", flex }}><div style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, marginBottom: 5 }}>{label}</div>{children}</label>;
export const L2 = ({ label, children, flex }) => <label style={{ display: "block", flex }}><div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700, marginBottom: 5 }}>{label}</div>{children}</label>;
export const Bar = ({ value, color }) => <div style={{ height: 6, width: 90, background: C.line, borderRadius: 999, overflow: "hidden" }}><div style={{ height: "100%", width: `${value}%`, background: color, transition: "width .4s ease" }} /></div>;
export const inputStyle = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", color: C.ink, background: "#fff", boxSizing: "border-box" };
