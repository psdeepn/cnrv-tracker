import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Plus, Trash2, X, Users, BarChart3, Shield, User, Pencil, Check,
  LogOut, Settings2, CalendarPlus, Award, Search, Download, Upload, Trophy,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Info, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Crown, Flag, Database, History, ArrowUpDown, Lock
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from "recharts";

/* ---------------------------------------------------------------------- */
/* Theme                                                                    */
/* ---------------------------------------------------------------------- */
const T = {
  bg: "#0A0F0C", surface: "#121712", surface2: "#1A211B", border: "#293227",
  text: "#E7ECE8", muted: "#8A968C", faint: "#5C6A59",
  accent: "#31C46E", accent2: "#5BB8E0", danger: "#E0655A", warning: "#E0A93E",
  chartPalette: ["#31C46E", "#5BB8E0", "#E0A93E", "#E0655A", "#B08BDB", "#6FE0C6"],
};
const uid = () => Math.random().toString(36).slice(2, 10);
function monthKeyFromDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function defaultMonthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", "'");
}
function currentMonthKey() { return monthKeyFromDate(new Date()); }
function nowStamp() { return new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

const DEFAULT_METRICS = [
  { id: "m_logins", name: "Logins", weight: 1 },
  { id: "m_igm", name: "In-Game Moderation", weight: 5 },
  { id: "m_dm", name: "Discord Moderation", weight: 5 },
  { id: "m_reports", name: "Reports", weight: 10 },
  { id: "m_events", name: "Events", weight: 15 },
  { id: "m_ar", name: "Admin-Request", weight: 25 },
  { id: "m_igr", name: "In-Game Reports", weight: 5 },
  { id: "m_st", name: "Support Tickets", weight: 10 },
];
const EXEMPT_OPTIONS = ["-", "Exempt", "Operator", "Trainee"];
const STATUS_OPTIONS = ["Active", "Absence", "Work Leave", "Exams", "Developer", "Inactive"];

/* ========================================================================
   CHANGE THIS before hosting anywhere public. This is a client-side gate,
   not real authentication — see README's security notes for what that
   means in practice.
   ======================================================================== */
const ADMIN_PIN = "CnRV@dm1n@08";

/* Seeded from the CnRV Mod Activity Sheet — June 2026. */
/* No roster is pre-loaded in the public build — import your real data
   privately after hosting, via Data & Backup > Restore from JSON.
   Never commit real staff data (names, Discord IDs, etc.) into this
   public repo or it becomes visible to anyone with the Pages URL. */
const DEFAULT_STAFF = [];
const DEFAULT_MONTHLY_DATA = {};

const DEFAULT_MONTHS = [];
const DEFAULT_MONTH_LABELS = {};

/* ---------------------------------------------------------------------- */
/* Storage — localStorage since this runs as a static file (no backend).   */
/* Data lives per-browser. Use Data & Backup tab to move it between        */
/* devices via a JSON export/import.                                       */
/* ---------------------------------------------------------------------- */
function loadKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function saveKey(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error("storage save failed", key, e); }
}

/* ---------------------------------------------------------------------- */
/* CSV helpers                                                              */
/* ---------------------------------------------------------------------- */
function csvValue(v) {
  if (v == null) return "";
  let s = String(v);
  // CSV formula-injection guard: neutralize leading =, +, -, @, tab, CR which
  // spreadsheet apps can interpret as the start of a formula/command.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function rowsToCSV(headers, rows) {
  return [headers.map(csvValue).join(","), ...rows.map((r) => r.map(csvValue).join(","))].join("\n");
}
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  return lines.map((line) => {
    const result = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") { result.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    result.push(cur);
    return result;
  });
}
function downloadFile(filename, content, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function FileButton({ label, onFile, accept = ".csv", icon: Icon = Upload }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => onFile(String(reader.result || ""));
        reader.readAsText(file);
        e.target.value = "";
      }} />
      <Btn variant="ghost" onClick={() => ref.current?.click()}><Icon size={14} /> {label}</Btn>
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* UI atoms                                                                 */
/* ---------------------------------------------------------------------- */
function Card({ children, className = "", style = {}, interactive = false }) {
  return (
    <div className={`rounded-xl transition-all duration-150 ${interactive ? "hover:-translate-y-0.5 hover:shadow-lg" : ""} ${className}`}
      style={{ background: T.surface, border: `1px solid ${T.border}`, ...style }}>
      {children}
    </div>
  );
}
function StatTile({ label, value, sub, accent }) {
  return (
    <Card className="p-4 flex flex-col gap-1">
      <span className="text-xs tracking-wide uppercase" style={{ color: T.faint, fontFamily: "Inter" }}>{label}</span>
      <span className="text-3xl" style={{ fontFamily: "Space Grotesk", color: accent || T.text, fontWeight: 600 }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: T.muted, fontFamily: "Inter" }}>{sub}</span>}
    </Card>
  );
}
function Btn({ children, onClick, variant = "solid", className = "", disabled }) {
  const base = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]";
  const hover = { solid: "hover:brightness-110", ghost: "hover:bg-white/5", danger: "hover:bg-red-500/10" };
  const styles = {
    solid: { background: T.accent, color: "#06170D" },
    ghost: { background: "transparent", color: T.text, border: `1px solid ${T.border}` },
    danger: { background: "transparent", color: T.danger, border: `1px solid ${T.danger}55` },
  };
  return <button disabled={disabled} onClick={onClick} className={`${base} ${hover[variant]} ${className}`} style={{ ...styles[variant], fontFamily: "Inter" }}>{children}</button>;
}
function Input(props) {
  return <input {...props} className={`px-3 py-2 rounded-lg text-sm outline-none w-full ${props.className || ""}`}
    style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: "Inter", ...(props.style || {}) }} />;
}
function Select(props) {
  return <select {...props} className={`px-3 py-2 rounded-lg text-sm outline-none w-full ${props.className || ""}`}
    style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: "Inter" }}>{props.children}</select>;
}
function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search size={14} color={T.faint} className="absolute left-3 top-1/2 -translate-y-1/2" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ paddingLeft: 30 }} />
    </div>
  );
}
function NumCell({ value, onChange, cellRef, onNav, onPasteBlock }) {
  return (
    <input type="number" min="0" value={value ?? ""} placeholder="0" ref={cellRef}
      onChange={(e) => onChange(e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0)}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") { e.preventDefault(); onNav("up"); }
        else if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); onNav("down"); }
        else if (e.key === "ArrowLeft" && e.target.selectionStart === 0) { e.preventDefault(); onNav("left"); }
        else if (e.key === "ArrowRight" && e.target.selectionStart === String(e.target.value).length) { e.preventDefault(); onNav("right"); }
      }}
      onPaste={(e) => {
        const text = e.clipboardData.getData("text");
        if (text.includes("\t") || text.includes("\n")) { e.preventDefault(); onPasteBlock(text); }
      }}
      className="w-14 text-center text-sm rounded-md outline-none py-1.5 transition-colors"
      style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: "JetBrains Mono" }}
      onFocus={(e) => (e.target.style.borderColor = T.accent)}
      onBlur={(e) => (e.target.style.borderColor = T.border)} />
  );
}

/* ---------------------------------------------------------------------- */
/* Toast notifications + audit log                                         */
/* ---------------------------------------------------------------------- */
/* ------------------------------------------------------------------------
   Anti-inspection layer — REQUESTED FEATURE, NOT SECURITY.
   This makes casual "right click -> view source / save as" harder and
   blocks the most common DevTools shortcuts. It does NOT stop anyone who:
     - opens DevTools via the browser menu instead of a shortcut
     - runs `curl`/`wget` on the URL, or uses view-source:
     - disables JavaScript before loading the page
     - uses their browser's built-in reader/translate/accessibility tools
   Every byte of this app is still delivered to the browser regardless of
   what happens after that — that's how the web works. Treat this purely
   as friction against casual copying, never as access control. Real data
   protection means not shipping secrets client-side (see README).
   ------------------------------------------------------------------------ */
function AntiInspectGuard() {
  const [devtoolsWarning, setDevtoolsWarning] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      body, p, span, div, h1, h2, h3, li, td, th, label, button {
        -webkit-user-select: none; user-select: none;
      }
      input, textarea, [data-selectable] {
        -webkit-user-select: text; user-select: text;
      }
    `;
    document.head.appendChild(style);

    const blockContextMenu = (e) => e.preventDefault();
    const blockShortcuts = (e) => {
      const k = e.key?.toLowerCase();
      const blocked =
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(k)) ||
        (e.metaKey && e.altKey && ["i", "j", "c"].includes(k)) ||
        (e.ctrlKey && k === "u") ||
        (e.metaKey && e.altKey && k === "u");
      if (blocked) e.preventDefault();
    };

    let checkInterval;
    const threshold = 160;
    const checkDevtools = () => {
      const widthGap = window.outerWidth - window.innerWidth > threshold;
      const heightGap = window.outerHeight - window.innerHeight > threshold;
      setDevtoolsWarning(widthGap || heightGap);
    };
    checkInterval = setInterval(checkDevtools, 1500);

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockShortcuts);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockShortcuts);
      clearInterval(checkInterval);
      style.remove();
    };
  }, []);

  if (!devtoolsWarning) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] px-3 py-1.5 text-center text-xs" style={{ background: T.warning, color: "#1A1305", fontFamily: "Inter" }}>
      This tool wasn't built to be inspected — but nothing stops a browser's DevTools from working. Don't treat client-side data as private.
    </div>
  );
}

function useToasts(onLog) {
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((message, type = "info") => {
    const id = uid();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    if (onLog) onLog(message, type);
  }, [onLog]);
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));
  return { toasts, notify, dismiss };
}
function ToastStack({ toasts, dismiss }) {
  const icons = { success: CheckCircle2, error: XCircle, info: Info };
  const colors = { success: T.accent, error: T.danger, info: T.accent2 };
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => {
        const Icon = icons[t.type] || Info;
        return (
          <div key={t.id} className="flex items-start gap-2 p-3 rounded-lg shadow-lg animate-in"
            style={{ background: T.surface2, border: `1px solid ${T.border}`, borderLeft: `3px solid ${colors[t.type]}` }}>
            <Icon size={16} color={colors[t.type]} className="shrink-0 mt-0.5" />
            <p className="text-xs flex-1" style={{ color: T.text, fontFamily: "Inter" }}>{t.message}</p>
            <button onClick={() => dismiss(t.id)}><X size={13} color={T.faint} /></button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Confirm dialog                                                           */
/* ---------------------------------------------------------------------- */
function useConfirm() {
  const [state, setState] = useState(null);
  const requestConfirm = (message, onConfirm, confirmLabel = "Delete") => setState({ message, onConfirm, confirmLabel });
  const close = () => setState(null);
  const node = state ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#000000aa" }}>
      <Card className="p-5 max-w-sm w-full" style={{ background: T.surface2 }}>
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle size={18} color={T.warning} className="shrink-0 mt-0.5" />
          <p className="text-sm" style={{ color: T.text, fontFamily: "Inter" }}>{state.message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <Btn variant="ghost" onClick={close}>Cancel</Btn>
          <Btn variant="danger" onClick={() => { state.onConfirm(); close(); }}>{state.confirmLabel}</Btn>
        </div>
      </Card>
    </div>
  ) : null;
  return { requestConfirm, node };
}

/* ---------------------------------------------------------------------- */
/* Leaderboard visual helpers                                              */
/* ---------------------------------------------------------------------- */
function RankBadge({ rank }) {
  const medal = rank === 1 ? "#E8C34A" : rank === 2 ? "#C7CDD6" : rank === 3 ? "#C98A4E" : null;
  if (medal) {
    return (
      <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${medal}22`, border: `1px solid ${medal}66` }}>
        <Crown size={12} color={medal} />
      </span>
    );
  }
  return <span className="w-6 text-xs text-right shrink-0" style={{ color: T.faint, fontFamily: "JetBrains Mono" }}>{rank}</span>;
}
function TrendBadge({ current, previous }) {
  if (previous == null) return null;
  const diff = current - previous;
  if (diff === 0) return <span className="flex items-center gap-0.5 text-xs shrink-0" style={{ color: T.faint, fontFamily: "Inter" }}><Minus size={11} />even</span>;
  const up = diff > 0;
  const pct = previous > 0 ? Math.round((Math.abs(diff) / previous) * 100) : null;
  const color = up ? T.accent : T.danger;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="flex items-center gap-0.5 text-xs shrink-0" style={{ color, fontFamily: "Inter" }}>
      <Icon size={11} />{pct != null ? `${pct}%` : Math.abs(diff)}
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/* Scoring helpers                                                          */
/* ---------------------------------------------------------------------- */
function staffScore(monthlyData, month, staffId, metrics) {
  const rec = monthlyData?.[month]?.[staffId];
  if (!rec) return 0;
  return metrics.reduce((sum, m) => sum + (rec[m.id] || 0) * m.weight, 0);
}
function metricTotal(monthlyData, month, metricId, staffList) {
  return staffList.reduce((sum, s) => sum + (monthlyData?.[month]?.[s.id]?.[metricId] || 0), 0);
}
function distinctValues(staff, key) {
  return [...new Set(staff.map((s) => (s[key] || "").trim()).filter(Boolean))].sort();
}

/* ---------------------------------------------------------------------- */
/* Login / role select — includes optional per-staff PIN check              */
/* ---------------------------------------------------------------------- */
function RoleSelect({ staff, onEnterAdmin, onEnterStaff }) {
  const [pin, setPin] = useState("");
  const [adminName, setAdminName] = useState(() => localStorage.getItem("cnrv:last-admin-name") || "");
  const [showPin, setShowPin] = useState(false);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState("");
  const [staffPin, setStaffPin] = useState("");
  const [staffErr, setStaffErr] = useState("");
  const [failCount, setFailCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);

  const tryAdmin = () => {
    if (Date.now() < lockedUntil) { setErr(`Too many attempts — wait ${Math.ceil((lockedUntil - Date.now()) / 1000)}s`); return; }
    if (pin !== ADMIN_PIN) {
      const next = failCount + 1;
      setFailCount(next);
      if (next >= 5) { setLockedUntil(Date.now() + 30000); setErr("Too many attempts — wait 30s"); }
      else setErr("Incorrect PIN");
      return;
    }
    setFailCount(0);
    const name = adminName.trim() || "Admin";
    localStorage.setItem("cnrv:last-admin-name", name);
    onEnterAdmin(name);
  };
  const tryStaff = () => {
    const person = staff.find((s) => s.id === picked);
    if (!person) return;
    if (person.pin && person.pin !== staffPin) { setStaffErr("Incorrect PIN for this profile"); return; }
    onEnterStaff(picked);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: T.bg }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <Shield size={22} color={T.accent} />
          </div>
          <h1 className="text-2xl" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 700 }}>CnRV Mod Activity</h1>
          <p className="text-sm mt-1" style={{ color: T.muted, fontFamily: "Inter" }}>Roster, monthly metrics, and scores — automated.</p>
        </div>
        {!showPin ? (
          <div className="flex flex-col gap-3">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3"><Shield size={16} color={T.accent} /><span style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Admin</span></div>
              <p className="text-xs mb-3" style={{ color: T.muted, fontFamily: "Inter" }}>Manage roster, metrics, log monthly counts, view team stats.</p>
              <Btn onClick={() => setShowPin(true)} className="w-full justify-center">Continue as admin</Btn>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3"><User size={16} color={T.accent2} /><span style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Staff</span></div>
              <p className="text-xs mb-3" style={{ color: T.muted, fontFamily: "Inter" }}>View your own score history and activity — read only.</p>
              <Select value={picked} onChange={(e) => { setPicked(e.target.value); setStaffErr(""); setStaffPin(""); }}>
                <option value="">Select your name…</option>
                {staff.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.inGameName}</option>)}
              </Select>
              {picked && staff.find((s) => s.id === picked)?.pin && (
                <Input type="password" placeholder="PIN" value={staffPin} onChange={(e) => { setStaffPin(e.target.value); setStaffErr(""); }} className="mt-2" onKeyDown={(e) => e.key === "Enter" && tryStaff()} />
              )}
              {staffErr && <p className="text-xs mt-2" style={{ color: T.danger, fontFamily: "Inter" }}>{staffErr}</p>}
              <Btn variant="ghost" disabled={!picked} onClick={tryStaff} className="w-full justify-center mt-3">View my activity</Btn>
            </Card>
          </div>
        ) : (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Admin sign-in</span>
              <button onClick={() => { setShowPin(false); setErr(""); }}><X size={16} color={T.muted} /></button>
            </div>
            <div className="flex flex-col gap-2">
              <Input placeholder="Your name (for the activity log)" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
              <Input type="password" placeholder="PIN" value={pin} onChange={(e) => { setPin(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && tryAdmin()} autoFocus />
            </div>
            {err && <p className="text-xs mt-2" style={{ color: T.danger, fontFamily: "Inter" }}>{err}</p>}
            <p className="text-xs mt-2" style={{ color: T.faint, fontFamily: "Inter" }}>Ask whoever set up this deployment for the admin PIN.</p>
            <Btn onClick={tryAdmin} className="w-full justify-center mt-3">Unlock</Btn>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Shell                                                                    */
/* ---------------------------------------------------------------------- */
function Shell({ role, onExit, tabs, tab, setTab, title, subtitle, children }) {
  return (
    <div className="min-h-screen flex" style={{ background: T.bg }}>
      <aside className="w-56 shrink-0 hidden sm:flex flex-col p-4 gap-1" style={{ borderRight: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-2 px-2 mb-6"><Shield size={18} color={T.accent} /><span style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 700 }}>CnRV</span></div>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-white/5"
            style={{ background: tab === t.key ? T.surface2 : "transparent", color: tab === t.key ? T.text : T.muted, fontFamily: "Inter", fontWeight: tab === t.key ? 600 : 400 }}>
            {tab === t.key && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: T.accent }} />}
            <t.icon size={16} color={tab === t.key ? T.accent : T.muted} />{t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={onExit} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-white/5" style={{ color: T.faint, fontFamily: "Inter" }}><LogOut size={16} /> Switch role</button>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 sticky top-0 z-10" style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <h2 style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 700, fontSize: 20 }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: T.muted, fontFamily: "Inter" }}>{subtitle}</p>}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ background: T.surface2, color: T.muted, fontFamily: "Inter" }}>
            {role === "admin" ? <Shield size={12} /> : <User size={12} />}{role === "admin" ? "Admin" : "Staff"}
          </div>
        </div>
        <div className="flex sm:hidden gap-1 px-4 pt-3 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap"
              style={{ background: tab === t.key ? T.surface2 : "transparent", color: tab === t.key ? T.text : T.muted, border: `1px solid ${T.border}`, fontFamily: "Inter" }}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
        <div className="p-5 sm:p-8">{children}</div>
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Month tab strip — reorder + inline rename                               */
/* ---------------------------------------------------------------------- */
function MonthStrip({ months, activeMonth, setActiveMonth, onAddMonth, getLabel, onRenameCommit, onDelete, onMove }) {
  const [renamingKey, setRenamingKey] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const startRename = (m) => { setRenamingKey(m); setRenameValue(getLabel(m)); };
  const commitRename = () => { if (renamingKey && renameValue.trim()) onRenameCommit(renamingKey, renameValue.trim()); setRenamingKey(null); };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ borderTop: `1px solid ${T.border}` }}>
      <button onClick={onAddMonth} className="flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-lg text-xs mt-2 transition-colors hover:brightness-110" style={{ background: T.surface2, color: T.accent, fontFamily: "Inter", border: `1px solid ${T.border}` }}>
        <CalendarPlus size={13} /> Add month
      </button>
      {months.map((m, i) => {
        const isActive = m === activeMonth;
        const isRenaming = renamingKey === m;
        return (
          <div key={m} className="group shrink-0 flex items-center mt-2 rounded-lg overflow-hidden transition-colors" style={{ border: `1px solid ${isActive ? T.accent : T.border}` }}>
            {i > 0 && (
              <button onClick={() => onMove(i, i - 1)} title="Move earlier" className="px-1 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: isActive ? T.accent : "transparent" }}>
                <ChevronLeft size={11} color={isActive ? "#06170D" : T.faint} />
              </button>
            )}
            {isRenaming ? (
              <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingKey(null); }}
                className="px-2 py-1.5 text-xs outline-none" style={{ width: 70, background: T.surface2, color: T.text, fontFamily: "Inter" }} />
            ) : (
              <button onClick={() => setActiveMonth(m)} onDoubleClick={() => startRename(m)} className="px-3 py-1.5 text-xs whitespace-nowrap transition-colors"
                style={{ background: isActive ? T.accent : "transparent", color: isActive ? "#06170D" : T.muted, fontFamily: "Inter", fontWeight: isActive ? 600 : 400 }}>
                {getLabel(m)}
              </button>
            )}
            <button onClick={() => startRename(m)} className="px-1.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: isActive ? T.accent : "transparent" }}>
              <Pencil size={11} color={isActive ? "#06170D" : T.faint} />
            </button>
            {i < months.length - 1 && (
              <button onClick={() => onMove(i, i + 1)} title="Move later" className="px-1 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: isActive ? T.accent : "transparent" }}>
                <ChevronRight size={11} color={isActive ? "#06170D" : T.faint} />
              </button>
            )}
            <button onClick={() => onDelete(m)} className="px-1.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: isActive ? T.accent : "transparent" }}>
              <X size={11} color={isActive ? "#06170D" : T.faint} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Admin: Monthly Activity                                                  */
/* ---------------------------------------------------------------------- */
function AdminMonthly({ staff, metrics, months, setMonths, monthlyData, setMonthlyData, monthLabels, setMonthLabels, notify }) {
  const [activeMonth, setActiveMonth] = useState(months[months.length - 1] || currentMonthKey());
  const [search, setSearch] = useState("");
  const [flagThreshold, setFlagThreshold] = useState(500);
  const { requestConfirm, node: confirmNode } = useConfirm();
  const cellRefs = useRef({});

  const activeStaff = staff.filter((s) => s.active);
  const filteredStaff = activeStaff.filter((s) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (s.inGameName || "").toLowerCase().includes(q) || (s.crew || "").toLowerCase().includes(q) || (s.region || "").toLowerCase().includes(q);
  });

  const getLabel = useCallback((key) => monthLabels?.[key] || defaultMonthLabel(key), [monthLabels]);

  const addMonth = () => {
    let d = new Date(); let candidate = currentMonthKey();
    while (months.includes(candidate)) { d.setMonth(d.getMonth() + 1); candidate = monthKeyFromDate(d); }
    setMonths([...months, candidate]);
    setActiveMonth(candidate);
    notify(`Added ${defaultMonthLabel(candidate)}`, "success");
  };
  const renameMonthCommit = (key, label) => { setMonthLabels({ ...monthLabels, [key]: label }); notify(`Renamed to "${label}"`, "success"); };
  const moveMonth = (from, to) => {
    if (to < 0 || to >= months.length) return;
    const next = [...months];
    [next[from], next[to]] = [next[to], next[from]];
    setMonths(next);
  };
  const deleteMonth = (key) => {
    requestConfirm(`Delete ${getLabel(key)}? This removes all logged counts for that month and can't be undone.`, () => {
      const nextMonths = months.filter((m) => m !== key);
      const nextData = { ...monthlyData }; delete nextData[key];
      const nextLabels = { ...monthLabels }; delete nextLabels[key];
      setMonths(nextMonths); setMonthlyData(nextData); setMonthLabels(nextLabels);
      if (activeMonth === key) setActiveMonth(nextMonths[nextMonths.length - 1] || currentMonthKey());
      notify(`Deleted ${getLabel(key)}`, "info");
    });
  };

  const setCell = (staffId, metricId, value) => {
    const next = { ...monthlyData };
    next[activeMonth] = { ...(next[activeMonth] || {}) };
    next[activeMonth][staffId] = { ...(next[activeMonth][staffId] || {}), [metricId]: value };
    setMonthlyData(next);
  };
  const toggleAbsent = (staffId) => {
    const next = { ...monthlyData };
    next[activeMonth] = { ...(next[activeMonth] || {}) };
    const rec = { ...(next[activeMonth][staffId] || {}) };
    rec.absent = !rec.absent;
    next[activeMonth][staffId] = rec;
    setMonthlyData(next);
  };

  /* Spreadsheet-style paste: paste a tab/newline block starting at a cell */
  const pasteBlock = (rowIdx, colIdx, text) => {
    const lines = text.trim().split(/\r?\n/).map((l) => l.split("\t"));
    const next = { ...monthlyData };
    next[activeMonth] = { ...(next[activeMonth] || {}) };
    lines.forEach((cells, li) => {
      const person = filteredStaff[rowIdx + li];
      if (!person) return;
      const rec = { ...(next[activeMonth][person.id] || {}) };
      cells.forEach((val, ci) => {
        const metric = metrics[colIdx + ci];
        if (!metric) return;
        const n = parseInt(String(val).trim(), 10);
        rec[metric.id] = isNaN(n) ? 0 : n;
      });
      next[activeMonth][person.id] = rec;
    });
    setMonthlyData(next);
    notify(`Pasted ${lines.length} row(s) of data`, "success");
  };
  const navigateCell = (rowIdx, colIdx, dir) => {
    let r = rowIdx, c = colIdx;
    if (dir === "up") r -= 1;
    if (dir === "down") r += 1;
    if (dir === "left") c -= 1;
    if (dir === "right") c += 1;
    const target = cellRefs.current[`${r}-${c}`];
    if (target) target.focus();
  };

  const leaderboard = useMemo(() =>
    activeStaff.map((s) => ({ ...s, score: staffScore(monthlyData, activeMonth, s.id, metrics) })).sort((a, b) => b.score - a.score),
    [activeStaff, monthlyData, activeMonth, metrics]);

  const allTimeLeaderboard = useMemo(() =>
    activeStaff.map((s) => ({ ...s, total: months.reduce((sum, m) => sum + staffScore(monthlyData, m, s.id, metrics), 0) })).sort((a, b) => b.total - a.total),
    [activeStaff, months, monthlyData, metrics]);

  const totalScore = leaderboard.reduce((s, x) => s + x.score, 0);

  const chronological = useMemo(() => [...months].sort(), [months]);
  const prevMonthKey = useMemo(() => {
    const idx = chronological.indexOf(activeMonth);
    return idx > 0 ? chronological[idx - 1] : null;
  }, [chronological, activeMonth]);
  const prevTotalScore = prevMonthKey ? activeStaff.reduce((s, st) => s + staffScore(monthlyData, prevMonthKey, st.id, metrics), 0) : null;
  const prevScoreByStaff = useMemo(() => {
    const map = {};
    activeStaff.forEach((s) => { map[s.id] = prevMonthKey ? staffScore(monthlyData, prevMonthKey, s.id, metrics) : null; });
    return map;
  }, [activeStaff, prevMonthKey, monthlyData, metrics]);

  const trend = useMemo(() => chronological.map((m) => ({
    month: getLabel(m), key: m, score: activeStaff.reduce((s, st) => s + staffScore(monthlyData, m, st.id, metrics), 0),
  })), [chronological, activeStaff, monthlyData, metrics, getLabel]);

  const crewCounts = useMemo(() => {
    const map = {}; activeStaff.forEach((s) => { const c = s.crew?.trim() || "—"; map[c] = (map[c] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [activeStaff]);
  const regionCounts = useMemo(() => {
    const map = {}; activeStaff.forEach((s) => { const r = s.region?.trim() || "—"; map[r] = (map[r] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [activeStaff]);

  const nonExempt = activeStaff.filter((s) => s.exempt !== "Exempt");
  const absentCount = nonExempt.filter((s) => monthlyData?.[activeMonth]?.[s.id]?.absent || s.status !== "Active").length;
  const absentPct = nonExempt.length ? ((absentCount / nonExempt.length) * 100).toFixed(1) : "0.0";

  /* Flagged / underperforming staff for this month */
  const flagged = useMemo(() => {
    return nonExempt
      .filter((s) => !(monthlyData?.[activeMonth]?.[s.id]?.absent) && s.status === "Active")
      .map((s) => {
        const score = staffScore(monthlyData, activeMonth, s.id, metrics);
        const rec = monthlyData?.[activeMonth]?.[s.id] || {};
        const totalActivity = metrics.reduce((sum, m) => sum + (rec[m.id] || 0), 0);
        const reasons = [];
        if (totalActivity === 0) reasons.push("Zero activity");
        else if (score < flagThreshold) reasons.push(`Below ${flagThreshold} pts`);
        return { ...s, score, reasons };
      })
      .filter((s) => s.reasons.length > 0)
      .sort((a, b) => a.score - b.score);
  }, [nonExempt, monthlyData, activeMonth, metrics, flagThreshold]);

  const exportMonthCSV = () => {
    const headers = ["Staff", ...metrics.map((m) => m.name), "Absent", "Score"];
    const rows = activeStaff.map((s) => [
      s.inGameName, ...metrics.map((m) => monthlyData?.[activeMonth]?.[s.id]?.[m.id] || 0),
      monthlyData?.[activeMonth]?.[s.id]?.absent ? "yes" : "no", staffScore(monthlyData, activeMonth, s.id, metrics),
    ]);
    downloadFile(`cnrv-${activeMonth}.csv`, rowsToCSV(headers, rows));
    notify("Exported month CSV", "success");
  };
  const importMonthCSV = (text) => {
    const rows = parseCSV(text);
    if (rows.length < 2) return;
    const headers = rows[0].map((h) => h.trim());
    const nameIdx = headers.findIndex((h) => h.toLowerCase() === "staff");
    const absentIdx = headers.findIndex((h) => h.toLowerCase() === "absent");
    const metricIdxByMetric = metrics.map((m) => ({ m, idx: headers.findIndex((h) => h.trim().toLowerCase() === m.name.toLowerCase()) }));
    const next = { ...monthlyData };
    next[activeMonth] = { ...(next[activeMonth] || {}) };
    let matched = 0, unmatched = [];
    rows.slice(1).forEach((r) => {
      const name = (r[nameIdx] || "").trim();
      const person = activeStaff.find((s) => s.inGameName.trim().toLowerCase() === name.toLowerCase());
      if (!person) { if (name) unmatched.push(name); return; }
      matched++;
      const rec = { ...(next[activeMonth][person.id] || {}) };
      metricIdxByMetric.forEach(({ m, idx }) => { if (idx >= 0) rec[m.id] = parseInt(r[idx], 10) || 0; });
      if (absentIdx >= 0) rec.absent = /^(yes|true|1)$/i.test((r[absentIdx] || "").trim());
      next[activeMonth][person.id] = rec;
    });
    setMonthlyData(next);
    notify(`Imported ${matched} row(s).${unmatched.length ? ` No match for: ${unmatched.join(", ")}.` : ""}`, unmatched.length ? "info" : "success");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col gap-1">
          <span className="text-xs tracking-wide uppercase" style={{ color: T.faint, fontFamily: "Inter" }}>Total score — {getLabel(activeMonth)}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl" style={{ fontFamily: "Space Grotesk", color: T.accent, fontWeight: 600 }}>{totalScore.toLocaleString()}</span>
            <TrendBadge current={totalScore} previous={prevTotalScore} />
          </div>
        </Card>
        <StatTile label="Active staff" value={activeStaff.length} />
        <StatTile label="Absent / away" value={`${absentCount}`} sub={`${absentPct}% of non-exempt`} accent={absentCount ? T.warning : undefined} />
        <StatTile label="Flagged" value={flagged.length} accent={flagged.length ? T.danger : undefined} sub="see below" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2"><Flag size={15} color={T.danger} /><h3 className="text-sm" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Flagged staff — {getLabel(activeMonth)}</h3></div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>Flag below</span>
            <input type="number" value={flagThreshold} onChange={(e) => setFlagThreshold(parseInt(e.target.value, 10) || 0)}
              className="w-20 text-center text-sm rounded-md outline-none py-1" style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: "JetBrains Mono" }} />
            <span className="text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>pts</span>
          </div>
        </div>
        {flagged.length === 0 ? (
          <p className="text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>Nobody flagged this month — everyone active is above threshold.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {flagged.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm py-1">
                <span className="flex-1 truncate" style={{ color: T.text, fontFamily: "Inter", fontWeight: 500 }}>{s.inGameName}</span>
                <span className="text-xs shrink-0" style={{ color: T.faint, fontFamily: "Inter" }}>{s.crew}</span>
                {s.reasons.map((r) => (
                  <span key={r} className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${T.danger}22`, color: T.danger, fontFamily: "Inter" }}>{r}</span>
                ))}
                <span className="shrink-0 w-14 text-right" style={{ color: T.text, fontFamily: "JetBrains Mono" }}>{s.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm mb-4" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Monthly score comparison</h3>
          {trend.length <= 1 ? <p className="text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>Add more months to see a comparison.</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trend}>
                <CartesianGrid stroke={T.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: T.faint, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                <YAxis tick={{ fill: T.faint, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {trend.map((t, i) => <Cell key={i} fill={t.key === activeMonth ? T.accent : T.surface2} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="text-sm mb-4" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Totals by metric — {getLabel(activeMonth)}</h3>
          <div className="flex flex-col gap-2">
            {metrics.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span style={{ color: T.muted, fontFamily: "Inter" }}>{m.name}</span>
                <span style={{ color: T.text, fontFamily: "JetBrains Mono" }}>{metricTotal(monthlyData, activeMonth, m.id, activeStaff)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm mb-3" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Crew member count</h3>
          <div className="flex flex-col gap-2">
            {crewCounts.map(([crew, count]) => (
              <div key={crew} className="flex items-center justify-between text-sm"><span style={{ color: T.text, fontFamily: "Inter" }}>{crew}</span><span style={{ color: T.accent, fontFamily: "JetBrains Mono" }}>{count}</span></div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm mb-3" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Staff by region</h3>
          <div className="flex flex-col gap-2">
            {regionCounts.map(([region, count]) => (
              <div key={region} className="flex items-center justify-between text-sm"><span style={{ color: T.text, fontFamily: "Inter" }}>{region}</span><span style={{ color: T.accent2, fontFamily: "JetBrains Mono" }}>{count}</span></div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4"><Award size={15} color={T.accent} /><h3 className="text-sm" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Leaderboard — {getLabel(activeMonth)}</h3></div>
        <div className="flex flex-col gap-2">
          {leaderboard.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 text-sm py-1 rounded-lg transition-colors hover:bg-white/5 px-1 -mx-1">
              <RankBadge rank={i + 1} />
              <span className="flex-1 truncate" style={{ color: T.text, fontFamily: "Inter", fontWeight: 500 }}>{s.inGameName}</span>
              <span className="text-xs shrink-0" style={{ color: T.faint, fontFamily: "Inter" }}>{s.crew}</span>
              {monthlyData?.[activeMonth]?.[s.id]?.absent && <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${T.warning}22`, color: T.warning, fontFamily: "Inter" }}>absent</span>}
              <TrendBadge current={s.score} previous={prevScoreByStaff[s.id]} />
              <span className="shrink-0 w-16 text-right" style={{ color: T.accent, fontFamily: "JetBrains Mono", fontWeight: 600 }}>{s.score.toLocaleString()}</span>
            </div>
          ))}
          {leaderboard.length === 0 && <p className="text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>No active staff yet — add someone in the Roster tab.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4"><Trophy size={15} color={T.warning} /><h3 className="text-sm" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>All-time leaderboard</h3></div>
        <p className="text-xs mb-3" style={{ color: T.faint, fontFamily: "Inter" }}>Summed across all {months.length} logged month{months.length === 1 ? "" : "s"}.</p>
        <div className="flex flex-col gap-2">
          {allTimeLeaderboard.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 text-sm py-1 rounded-lg transition-colors hover:bg-white/5 px-1 -mx-1">
              <RankBadge rank={i + 1} />
              <span className="flex-1 truncate" style={{ color: T.text, fontFamily: "Inter", fontWeight: 500 }}>{s.inGameName}</span>
              <span className="text-xs shrink-0" style={{ color: T.faint, fontFamily: "Inter" }}>{s.crew}</span>
              <span className="shrink-0" style={{ color: T.warning, fontFamily: "JetBrains Mono", fontWeight: 600 }}>{s.total.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-5 pb-0 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm mb-1" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Log entries — {getLabel(activeMonth)}</h3>
            <p className="text-xs mb-3" style={{ color: T.faint, fontFamily: "Inter" }}>Type directly, use arrow keys to move between cells, or paste a block copied from a spreadsheet.</p>
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={exportMonthCSV}><Download size={14} /> Export CSV</Btn>
            <FileButton label="Import CSV" onFile={importMonthCSV} />
          </div>
        </div>
        <div className="px-5 pb-3">
          <SearchBox value={search} onChange={setSearch} placeholder="Search staff by name, crew, or region…" />
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto px-5 pb-3">
          <table className="min-w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 sticky left-0" style={{ color: T.muted, fontFamily: "Inter", background: T.surface }}>Staff</th>
                {metrics.map((m) => <th key={m.id} className="text-center py-2 px-2 text-xs whitespace-nowrap" style={{ color: T.muted, fontFamily: "Inter" }}>{m.name}</th>)}
                <th className="text-center py-2 px-2 text-xs" style={{ color: T.muted, fontFamily: "Inter" }}>Absent</th>
                <th className="text-right py-2 pl-2 text-xs" style={{ color: T.muted, fontFamily: "Inter" }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((s, rowIdx) => (
                <tr key={s.id} className="transition-colors hover:bg-white/5" style={{ borderTop: `1px solid ${T.border}` }}>
                  <td className="py-2 pr-3 sticky left-0 whitespace-nowrap" style={{ color: T.text, fontFamily: "Inter", background: T.surface }}>{s.inGameName}</td>
                  {metrics.map((m, colIdx) => (
                    <td key={m.id} className="py-2 px-2 text-center">
                      <NumCell
                        value={monthlyData?.[activeMonth]?.[s.id]?.[m.id]}
                        onChange={(v) => setCell(s.id, m.id, v)}
                        cellRef={(el) => { cellRefs.current[`${rowIdx}-${colIdx}`] = el; }}
                        onNav={(dir) => navigateCell(rowIdx, colIdx, dir)}
                        onPasteBlock={(text) => pasteBlock(rowIdx, colIdx, text)}
                      />
                    </td>
                  ))}
                  <td className="py-2 px-2 text-center"><input type="checkbox" checked={!!monthlyData?.[activeMonth]?.[s.id]?.absent} onChange={() => toggleAbsent(s.id)} /></td>
                  <td className="py-2 pl-2 text-right" style={{ color: T.accent, fontFamily: "JetBrains Mono", fontWeight: 600 }}>{staffScore(monthlyData, activeMonth, s.id, metrics).toLocaleString()}</td>
                </tr>
              ))}
              {filteredStaff.length === 0 && <tr><td colSpan={metrics.length + 3} className="py-3 text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>No matching staff.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Mobile card view */}
        <div className="sm:hidden flex flex-col gap-3 px-5 pb-3">
          {filteredStaff.map((s) => (
            <Card key={s.id} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm" style={{ color: T.text, fontFamily: "Inter", fontWeight: 600 }}>{s.inGameName}</span>
                <label className="flex items-center gap-1.5 text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>
                  <input type="checkbox" checked={!!monthlyData?.[activeMonth]?.[s.id]?.absent} onChange={() => toggleAbsent(s.id)} /> Absent
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {metrics.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs truncate" style={{ color: T.muted, fontFamily: "Inter" }}>{m.name}</span>
                    <NumCell
                      value={monthlyData?.[activeMonth]?.[s.id]?.[m.id]}
                      onChange={(v) => setCell(s.id, m.id, v)}
                      cellRef={() => {}}
                      onNav={() => {}}
                      onPasteBlock={() => {}}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-2 pt-2" style={{ borderTop: `1px solid ${T.border}` }}>
                <span className="text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>Score: </span>
                <span className="text-sm ml-1" style={{ color: T.accent, fontFamily: "JetBrains Mono", fontWeight: 600 }}>{staffScore(monthlyData, activeMonth, s.id, metrics).toLocaleString()}</span>
              </div>
            </Card>
          ))}
          {filteredStaff.length === 0 && <p className="text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>No matching staff.</p>}
        </div>

        <div className="px-5">
          <p className="text-xs mb-1" style={{ color: T.faint, fontFamily: "Inter" }}>Hover a tab to reorder, rename, or delete it.</p>
          <MonthStrip months={months} activeMonth={activeMonth} setActiveMonth={setActiveMonth} onAddMonth={addMonth} getLabel={getLabel} onRenameCommit={renameMonthCommit} onDelete={deleteMonth} onMove={moveMonth} />
        </div>
      </Card>
      {confirmNode}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Admin: Roster                                                            */
/* ---------------------------------------------------------------------- */
const blankStaff = () => ({
  id: uid(), inGameName: "", position: "", crew: "", uid_: "", did: "", region: "",
  trainer: "", exempt: "-", status: "Active", statusNote: "", pin: "", joinDate: "", lastPromotion: "", active: true,
});
const ROSTER_HEADERS = ["In-Game Name","Position","Crew","UID","Discord ID","Region","Trainer","Exempt","Status","Status Note","Team First Join Date","Last Promotion","Active"];

function AdminRoster({ staff, setStaff, notify }) {
  const [form, setForm] = useState(blankStaff());
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("inGameName");
  const [sortDir, setSortDir] = useState("asc");
  const { requestConfirm, node: confirmNode } = useConfirm();

  const crewOptions = distinctValues(staff, "crew");
  const regionOptions = distinctValues(staff, "region");

  const add = () => { if (!form.inGameName.trim()) return; setStaff([...staff, { ...form, id: uid() }]); setForm(blankStaff()); notify(`Added ${form.inGameName.trim()}`, "success"); };
  const remove = (s) => requestConfirm(`Remove ${s.inGameName} from the roster? Their logged activity history stays intact but they'll disappear from staff lists.`, () => {
    setStaff(staff.filter((x) => x.id !== s.id));
    notify(`Removed ${s.inGameName}`, "info");
  });
  const toggleActive = (id) => setStaff(staff.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  const startEdit = (s) => { setEditingId(s.id); setForm({ ...blankStaff(), ...s }); };
  const saveEdit = () => { setStaff(staff.map((s) => (s.id === editingId ? { ...form } : s))); setEditingId(null); setForm(blankStaff()); notify("Changes saved", "success"); };
  const cancelEdit = () => { setEditingId(null); setForm(blankStaff()); };

  const field = (key, placeholder, extra = {}) => <Input placeholder={placeholder} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...extra} />;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = staff.filter((s) => {
      if (!q) return true;
      return [s.inGameName, s.position, s.crew, s.region, s.uid_, s.did].some((v) => (v || "").toLowerCase().includes(q));
    });
    list = [...list].sort((a, b) => {
      const av = (a[sortKey] || "").toString().toLowerCase();
      const bv = (b[sortKey] || "").toString().toLowerCase();
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [staff, search, sortKey, sortDir]);

  const exportCSV = () => {
    const rows = staff.map((s) => [s.inGameName, s.position, s.crew, s.uid_, s.did, s.region, s.trainer, s.exempt, s.status || "Active", s.statusNote || "", s.joinDate, s.lastPromotion, s.active ? "yes" : "no"]);
    downloadFile("cnrv-roster.csv", rowsToCSV(ROSTER_HEADERS, rows));
    notify("Exported roster CSV", "success");
  };
  const importCSV = (text) => {
    const rows = parseCSV(text);
    if (rows.length < 2) return;
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (name) => headers.findIndex((h) => h === name.toLowerCase());
    const map = {
      inGameName: idx("in-game name"), position: idx("position"), crew: idx("crew"), uid_: idx("uid"), did: idx("discord id"),
      region: idx("region"), trainer: idx("trainer"), exempt: idx("exempt"), status: idx("status"), statusNote: idx("status note"),
      joinDate: idx("team first join date"), lastPromotion: idx("last promotion"), active: idx("active"),
    };
    let next = [...staff]; let added = 0, updated = 0;
    rows.slice(1).forEach((r) => {
      const name = (r[map.inGameName] ?? "").trim();
      if (!name) return;
      const record = {
        inGameName: name, position: r[map.position] ?? "", crew: r[map.crew] ?? "", uid_: r[map.uid_] ?? "", did: r[map.did] ?? "",
        region: r[map.region] ?? "", trainer: r[map.trainer] ?? "", exempt: r[map.exempt] || "-",
        status: (map.status >= 0 && r[map.status]) || "Active", statusNote: r[map.statusNote] ?? "",
        joinDate: r[map.joinDate] ?? "", lastPromotion: r[map.lastPromotion] ?? "",
        active: map.active >= 0 ? !/^(no|false|0)$/i.test((r[map.active] || "").trim()) : true,
      };
      const existingIdx = next.findIndex((s) => s.inGameName.trim().toLowerCase() === name.toLowerCase());
      if (existingIdx >= 0) { next[existingIdx] = { ...next[existingIdx], ...record }; updated++; }
      else { next.push({ ...blankStaff(), ...record, id: uid() }); added++; }
    });
    setStaff(next);
    notify(`Imported roster: ${added} added, ${updated} updated.`, "success");
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 max-w-3xl">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-sm" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>{editingId ? "Edit staff member" : "Add staff member"}</h3>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={exportCSV}><Download size={14} /> Export CSV</Btn>
            <FileButton label="Import CSV" onFile={importCSV} />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          {field("inGameName", "In-game name")}
          {field("position", "Position")}
          {field("crew", "Crew (e.g. GRU, TXC)", { list: "crew-options" })}
          {field("uid_", "UID")}
          {field("did", "Discord ID")}
          {field("region", "Region (e.g. US, EU, SEA)", { list: "region-options" })}
          {field("trainer", "Trainer")}
          <Select value={form.exempt} onChange={(e) => setForm({ ...form, exempt: e.target.value })}>
            {EXEMPT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </Select>
          {field("statusNote", "Status note (optional)")}
          {field("joinDate", "Team first join date")}
          {field("lastPromotion", "Last promotion / reintegration")}
          {field("pin", "Staff PIN (optional, locks their view)")}
        </div>
        <datalist id="crew-options">{crewOptions.map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="region-options">{regionOptions.map((r) => <option key={r} value={r} />)}</datalist>
        <div className="flex gap-2 mt-3">
          <Btn onClick={editingId ? saveEdit : add}><Plus size={15} /> {editingId ? "Save changes" : "Add"}</Btn>
          {editingId && <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>}
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1"><SearchBox value={search} onChange={setSearch} placeholder="Search roster by name, position, crew, region, UID…" /></div>
        <Select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="sm:w-44">
          <option value="inGameName">Sort: Name</option>
          <option value="position">Sort: Position</option>
          <option value="crew">Sort: Crew</option>
          <option value="region">Sort: Region</option>
          <option value="joinDate">Sort: Join date</option>
        </Select>
        <Btn variant="ghost" onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")} className="shrink-0">
          <ArrowUpDown size={14} /> {sortDir === "asc" ? "A→Z" : "Z→A"}
        </Btn>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((s) => (
          <Card key={s.id} interactive className="p-3.5 flex items-center gap-3 flex-wrap">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0" style={{ background: T.surface2, color: T.text, fontFamily: "Space Grotesk" }}>{s.inGameName.slice(0, 1).toUpperCase() || "?"}</div>
            <div className="min-w-0">
              <p className="text-sm truncate flex items-center gap-1.5" style={{ color: T.text, fontFamily: "Inter", fontWeight: 500 }}>
                {s.inGameName || "Unnamed"}
                {s.pin && <Lock size={11} color={T.faint} title="PIN protected" />}
              </p>
              <p className="text-xs truncate" style={{ color: T.faint, fontFamily: "Inter" }}>{[s.position, s.crew, s.region].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            {s.exempt !== "-" && <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: `${T.accent2}22`, color: T.accent2, fontFamily: "Inter" }}>{s.exempt}</span>}
            {s.status && s.status !== "Active" && (
              <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: `${T.warning}22`, color: T.warning, fontFamily: "Inter" }}>{s.status}{s.statusNote ? ` · ${s.statusNote}` : ""}</span>
            )}
            <button onClick={() => toggleActive(s.id)} className="text-xs px-2 py-1 rounded-full shrink-0 transition-colors" style={{ background: s.active ? `${T.accent}22` : `${T.faint}22`, color: s.active ? T.accent : T.faint, fontFamily: "Inter" }}>{s.active ? "Active" : "Inactive"}</button>
            <button onClick={() => startEdit(s)}><Pencil size={14} color={T.muted} /></button>
            <button onClick={() => remove(s)}><Trash2 size={14} color={T.danger} /></button>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>{staff.length === 0 ? "No staff yet — add your first roster entry above." : "No matches."}</p>}
      </div>
      {confirmNode}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Admin: Metrics                                                           */
/* ---------------------------------------------------------------------- */
function AdminMetrics({ metrics, setMetrics, notify }) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("1");
  const { requestConfirm, node: confirmNode } = useConfirm();
  const add = () => { if (!name.trim()) return; setMetrics([...metrics, { id: uid(), name: name.trim(), weight: parseFloat(weight) || 1 }]); setName(""); setWeight("1"); notify(`Added metric "${name.trim()}"`, "success"); };
  const remove = (m) => requestConfirm(`Delete the "${m.name}" metric? Historical counts logged under it will stop contributing to scores.`, () => {
    setMetrics(metrics.filter((x) => x.id !== m.id));
    notify(`Deleted "${m.name}"`, "info");
  });
  const updateWeight = (id, w) => setMetrics(metrics.map((m) => (m.id === id ? { ...m, weight: w } : m)));

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <Card className="p-5">
        <h3 className="text-sm mb-3" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Add activity metric</h3>
        <p className="text-xs mb-3" style={{ color: T.faint, fontFamily: "Inter" }}>Weight is the points a single unit of this activity contributes to a staff member's score.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="e.g. Reports, Events, Admin-Request" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Input type="number" step="1" placeholder="Weight" value={weight} onChange={(e) => setWeight(e.target.value)} className="sm:w-28" />
          <Btn onClick={add} className="shrink-0"><Plus size={15} /> Add</Btn>
        </div>
      </Card>
      <div className="flex flex-col gap-2">
        {metrics.map((m, i) => (
          <Card key={m.id} interactive className="p-3.5 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: T.chartPalette[i % T.chartPalette.length] }} />
            <span className="flex-1 text-sm" style={{ color: T.text, fontFamily: "Inter", fontWeight: 500 }}>{m.name}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>weight</span>
              <input type="number" value={m.weight} onChange={(e) => updateWeight(m.id, parseFloat(e.target.value) || 0)} className="w-16 text-center text-sm rounded-md outline-none py-1 transition-colors" style={{ background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontFamily: "JetBrains Mono" }} />
            </div>
            <button onClick={() => remove(m)}><Trash2 size={14} color={T.danger} /></button>
          </Card>
        ))}
        {metrics.length === 0 && <p className="text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>No metrics yet — add the activities your team should log.</p>}
      </div>
      {confirmNode}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Admin: Data & Backup + Audit log                                         */
/* ---------------------------------------------------------------------- */
function AdminData({ staff, metrics, months, monthlyData, monthLabels, auditLog, setAll, notify }) {
  const { requestConfirm, node: confirmNode } = useConfirm();

  const exportAll = () => {
    const payload = { staff, metrics, months, monthlyData, monthLabels, exportedAt: new Date().toISOString() };
    downloadFile(`cnrv-full-backup-${currentMonthKey()}.json`, JSON.stringify(payload, null, 2), "application/json");
    notify("Full backup exported", "success");
  };
  const importAll = (text) => {
    let data;
    try { data = JSON.parse(text); } catch { notify("Invalid JSON file", "error"); return; }
    requestConfirm("Restore from this backup? This replaces ALL current staff, metrics, and monthly data.", () => {
      setAll({
        staff: data.staff || [], metrics: data.metrics || DEFAULT_METRICS,
        months: data.months || [], monthlyData: data.monthlyData || {}, monthLabels: data.monthLabels || {},
      });
      notify("Backup restored", "success");
    }, "Restore");
  };

  const totalEntries = months.length;
  const totalStaff = staff.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Staff on roster" value={totalStaff} />
        <StatTile label="Months logged" value={totalEntries} />
        <StatTile label="Storage location" value="This browser" sub="localStorage — see note below" />
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-2"><Database size={16} color={T.accent} /><h3 className="text-sm" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Full backup & restore</h3></div>
        <p className="text-xs mb-4" style={{ color: T.faint, fontFamily: "Inter" }}>
          This app stores its data in your browser's local storage — there's no shared server. That means data doesn't
          automatically sync between different browsers or devices. Use export/import below to move a complete snapshot
          (roster, metrics, every logged month) between devices, or to keep an off-site backup.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={exportAll}><Download size={15} /> Export everything (JSON)</Btn>
          <FileButton label="Restore from JSON" accept=".json" onFile={importAll} />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3"><History size={16} color={T.accent2} /><h3 className="text-sm" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Recent activity log</h3></div>
        <p className="text-xs mb-3" style={{ color: T.faint, fontFamily: "Inter" }}>Every admin action taken in this browser, most recent first. Since admin access uses a shared PIN, each admin enters their name at sign-in so actions can be attributed.</p>
        <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
          {[...auditLog].reverse().map((e) => (
            <div key={e.id} className="flex items-start gap-2 text-xs py-1" style={{ borderBottom: `1px solid ${T.border}` }}>
              <span className="shrink-0 w-28" style={{ color: T.faint, fontFamily: "JetBrains Mono" }}>{e.stamp}</span>
              <span className="shrink-0 w-20 truncate" style={{ color: T.accent2, fontFamily: "Inter", fontWeight: 500 }}>{e.actor}</span>
              <span style={{ color: T.text, fontFamily: "Inter" }}>{e.message}</span>
            </div>
          ))}
          {auditLog.length === 0 && <p className="text-xs" style={{ color: T.faint, fontFamily: "Inter" }}>No actions logged yet.</p>}
        </div>
      </Card>
      {confirmNode}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Staff self view                                                          */
/* ---------------------------------------------------------------------- */
function StaffDashboard({ me, metrics, months, monthlyData, monthLabels }) {
  const getLabel = (key) => monthLabels?.[key] || defaultMonthLabel(key);
  const sortedMonths = [...months].sort();
  const trend = sortedMonths.map((m) => ({ month: getLabel(m), score: staffScore(monthlyData, m, me.id, metrics) }));

  // Default to the most recent month that actually has data logged for this
  // person; fall back to the latest month overall. This avoids showing a 0 when
  // the newest month simply hasn't been filled in yet.
  const monthsWithData = sortedMonths.filter((m) => monthlyData?.[m]?.[me.id]);
  const defaultMonth = monthsWithData[monthsWithData.length - 1] || sortedMonths[sortedMonths.length - 1] || "";
  const [selMonth, setSelMonth] = useState(defaultMonth);
  const activeMonth = months.includes(selMonth) ? selMonth : defaultMonth;

  const rec = monthlyData?.[activeMonth]?.[me.id] || {};
  const selScore = activeMonth ? staffScore(monthlyData, activeMonth, me.id, metrics) : 0;
  // Show every metric (Logins, Reports, etc.) for the selected month — including
  // zeros — with the points each contributes (count × weight).
  const breakdown = metrics.map((m) => ({ name: m.name, value: rec[m.id] || 0, weight: m.weight, points: (rec[m.id] || 0) * m.weight }));
  const isAbsent = !!rec.absent;
  const absentMonths = sortedMonths.filter((m) => monthlyData?.[m]?.[me.id]?.absent).length;

  return (
    <div className="flex flex-col gap-6">
      {sortedMonths.length > 0 && (
        <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs tracking-wide uppercase shrink-0" style={{ color: T.faint, fontFamily: "Inter" }}>Viewing month</span>
          <Select value={activeMonth} onChange={(e) => setSelMonth(e.target.value)} className="sm:max-w-xs">
            {sortedMonths.map((m) => <option key={m} value={m}>{getLabel(m)}</option>)}
          </Select>
          {isAbsent && <span className="text-xs px-2 py-1 rounded-full shrink-0" style={{ background: `${T.warning}22`, color: T.warning, fontFamily: "Inter" }}>Marked absent this month</span>}
        </Card>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label={activeMonth ? `Total score — ${getLabel(activeMonth)}` : "Score"} value={selScore.toLocaleString()} accent={T.accent} />
        <StatTile label="Position" value={me.position || "—"} />
        <StatTile label="Months absent" value={absentMonths} accent={absentMonths ? T.warning : undefined} />
      </div>
      <Card className="p-5">
        <h3 className="text-sm mb-2" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Roster info</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between"><span style={{ color: T.faint, fontFamily: "Inter" }}>Crew</span><span style={{ color: T.text, fontFamily: "Inter" }}>{me.crew || "—"}</span></div>
          <div className="flex justify-between"><span style={{ color: T.faint, fontFamily: "Inter" }}>Region</span><span style={{ color: T.text, fontFamily: "Inter" }}>{me.region || "—"}</span></div>
          <div className="flex justify-between"><span style={{ color: T.faint, fontFamily: "Inter" }}>Trainer</span><span style={{ color: T.text, fontFamily: "Inter" }}>{me.trainer || "—"}</span></div>
          <div className="flex justify-between"><span style={{ color: T.faint, fontFamily: "Inter" }}>Status</span><span style={{ color: T.text, fontFamily: "Inter" }}>{me.status || "Active"}{me.statusNote ? ` (${me.statusNote})` : ""}</span></div>
          <div className="flex justify-between"><span style={{ color: T.faint, fontFamily: "Inter" }}>Exempt status</span><span style={{ color: T.text, fontFamily: "Inter" }}>{me.exempt}</span></div>
          <div className="flex justify-between"><span style={{ color: T.faint, fontFamily: "Inter" }}>Team joined</span><span style={{ color: T.text, fontFamily: "Inter" }}>{me.joinDate || "—"}</span></div>
          <div className="flex justify-between"><span style={{ color: T.faint, fontFamily: "Inter" }}>Last promotion</span><span style={{ color: T.text, fontFamily: "Inter" }}>{me.lastPromotion || "—"}</span></div>
        </div>
      </Card>
      {trend.length > 1 && (
        <Card className="p-5">
          <h3 className="text-sm mb-4" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Your score history</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trend}>
              <CartesianGrid stroke={T.border} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: T.faint, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
              <YAxis tick={{ fill: T.faint, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="score" fill={T.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
      {activeMonth && (
        <Card className="p-5">
          <h3 className="text-sm mb-4" style={{ fontFamily: "Space Grotesk", color: T.text, fontWeight: 600 }}>Activity breakdown — {getLabel(activeMonth)}</h3>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-2 text-sm items-center">
            <span className="text-xs uppercase tracking-wide" style={{ color: T.faint, fontFamily: "Inter" }}>Metric</span>
            <span className="text-xs uppercase tracking-wide text-right" style={{ color: T.faint, fontFamily: "Inter" }}>Count</span>
            <span className="text-xs uppercase tracking-wide text-right" style={{ color: T.faint, fontFamily: "Inter" }}>Points</span>
            {breakdown.map((b) => (
              <React.Fragment key={b.name}>
                <span style={{ color: T.muted, fontFamily: "Inter" }}>{b.name}<span style={{ color: T.faint }}> ×{b.weight}</span></span>
                <span className="text-right" style={{ color: T.text, fontFamily: "JetBrains Mono" }}>{b.value}</span>
                <span className="text-right" style={{ color: b.points ? T.text : T.faint, fontFamily: "JetBrains Mono" }}>{b.points.toLocaleString()}</span>
              </React.Fragment>
            ))}
            <span className="pt-2 mt-1" style={{ color: T.text, fontFamily: "Inter", fontWeight: 600, borderTop: `1px solid ${T.border}` }}>Total</span>
            <span className="pt-2 mt-1 text-right" style={{ borderTop: `1px solid ${T.border}` }}></span>
            <span className="pt-2 mt-1 text-right" style={{ color: T.accent, fontFamily: "JetBrains Mono", fontWeight: 600, borderTop: `1px solid ${T.border}` }}>{selScore.toLocaleString()}</span>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Root                                                                     */
/* ---------------------------------------------------------------------- */
function App() {
  const [role, setRole] = useState(null);
  const [adminName, setAdminName] = useState("Admin");
  const [myStaffId, setMyStaffId] = useState(null);
  const [tab, setTab] = useState("monthly");

  const [staff, setStaffState] = useState(() => loadKey("cnrv:staff", DEFAULT_STAFF));
  const [metrics, setMetricsState] = useState(() => loadKey("cnrv:metrics", DEFAULT_METRICS));
  const [months, setMonthsState] = useState(() => loadKey("cnrv:months", DEFAULT_MONTHS));
  const [monthlyData, setMonthlyDataState] = useState(() => loadKey("cnrv:monthly-data", DEFAULT_MONTHLY_DATA));
  const [monthLabels, setMonthLabelsState] = useState(() => loadKey("cnrv:month-labels", DEFAULT_MONTH_LABELS));
  const [auditLog, setAuditLogState] = useState(() => loadKey("cnrv:audit-log", []));

  const setStaff = useCallback((n) => { setStaffState(n); saveKey("cnrv:staff", n); }, []);
  const setMetrics = useCallback((n) => { setMetricsState(n); saveKey("cnrv:metrics", n); }, []);
  const setMonths = useCallback((n) => { setMonthsState(n); saveKey("cnrv:months", n); }, []);
  const setMonthlyData = useCallback((n) => { setMonthlyDataState(n); saveKey("cnrv:monthly-data", n); }, []);
  const setMonthLabels = useCallback((n) => { setMonthLabelsState(n); saveKey("cnrv:month-labels", n); }, []);

  const setAll = useCallback((data) => {
    setStaff(data.staff); setMetrics(data.metrics); setMonths(data.months);
    setMonthlyData(data.monthlyData); setMonthLabels(data.monthLabels);
  }, [setStaff, setMetrics, setMonths, setMonthlyData, setMonthLabels]);

  const logAction = useCallback((message, type) => {
    setAuditLogState((prev) => {
      const next = [...prev, { id: uid(), stamp: nowStamp(), actor: adminName, message, type }].slice(-300);
      saveKey("cnrv:audit-log", next);
      return next;
    });
  }, [adminName]);
  const { toasts, notify, dismiss } = useToasts(logAction);

  if (!role) {
    return (
      <>
        <AntiInspectGuard />
        <RoleSelect staff={staff} onEnterAdmin={(name) => { setAdminName(name); setRole("admin"); }} onEnterStaff={(id) => { setMyStaffId(id); setRole("staff"); }} />
        <ToastStack toasts={toasts} dismiss={dismiss} />
      </>
    );
  }

  if (role === "staff") {
    const me = staff.find((s) => s.id === myStaffId);
    return (
      <>
        <AntiInspectGuard />
        <Shell role="staff" onExit={() => setRole(null)} tabs={[{ key: "me", label: "My activity", icon: User }]} tab="me" setTab={() => {}} title={me ? me.inGameName : "My activity"} subtitle={me?.position}>
          {me ? <StaffDashboard me={me} metrics={metrics} months={months} monthlyData={monthlyData} monthLabels={monthLabels} /> : <p style={{ color: T.faint, fontFamily: "Inter" }}>Staff member not found.</p>}
        </Shell>
        <ToastStack toasts={toasts} dismiss={dismiss} />
      </>
    );
  }

  const adminTabs = [
    { key: "monthly", label: "Monthly activity", icon: BarChart3 },
    { key: "roster", label: "Roster", icon: Users },
    { key: "metrics", label: "Metrics", icon: Settings2 },
    { key: "data", label: "Data & Backup", icon: Database },
  ];
  const titles = {
    monthly: ["Monthly activity", "Log counts, review scores, and catch who's falling behind"],
    roster: ["Roster", "Add, remove, search, sort, import or export staff"],
    metrics: ["Metrics", "Define what gets tracked and how it's weighted"],
    data: ["Data & Backup", "Full export/import and the admin activity log"],
  };

  return (
    <>
      <AntiInspectGuard />
      <Shell role="admin" onExit={() => setRole(null)} tabs={adminTabs} tab={tab} setTab={setTab} title={titles[tab][0]} subtitle={titles[tab][1]}>
        {tab === "monthly" && (
          <AdminMonthly staff={staff} metrics={metrics} months={months} setMonths={setMonths} monthlyData={monthlyData} setMonthlyData={setMonthlyData} monthLabels={monthLabels} setMonthLabels={setMonthLabels} notify={notify} />
        )}
        {tab === "roster" && <AdminRoster staff={staff} setStaff={setStaff} notify={notify} />}
        {tab === "metrics" && <AdminMetrics metrics={metrics} setMetrics={setMetrics} notify={notify} />}
        {tab === "data" && <AdminData staff={staff} metrics={metrics} months={months} monthlyData={monthlyData} monthLabels={monthLabels} auditLog={auditLog} setAll={setAll} notify={notify} />}
      </Shell>
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);