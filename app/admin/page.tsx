"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { openMarksheet, downloadClassReportCSV } from "@/lib/marksheet";

/* ─── Types ─────────────────────────────────────────────── */
interface SessionRow { id: string; studentName: string; studentId: string | null; score: number | null; totalMarks: number; submittedAt: string | null; resultVisible: boolean; }
interface AdminUser  { id: string; username: string; createdAt: string; }

type QTypeKey = "mcq" | "trueFalse" | "fillBlank" | "code";
type QTypeState = { enabled: boolean; count: number; marksEach: number };
type QConfig    = Record<QTypeKey, QTypeState>;

const QTYPES: { key: QTypeKey; label: string; icon: string }[] = [
  { key: "mcq",       label: "Multiple Choice (MCQ)",  icon: "◉" },
  { key: "trueFalse", label: "True / False",            icon: "T/F" },
  { key: "fillBlank", label: "Fill in the Blank",       icon: "___" },
  { key: "code",      label: "Coding Question",         icon: "</>" },
];

const DEFAULT_QCONFIG: QConfig = {
  mcq:       { enabled: true,  count: 40, marksEach: 2 },
  trueFalse: { enabled: false, count: 10, marksEach: 1 },
  fillBlank: { enabled: false, count: 5,  marksEach: 2 },
  code:      { enabled: false, count: 2,  marksEach: 5 },
};

function calcTotal(qc: QConfig) {
  return (Object.values(qc) as QTypeState[]).filter((v) => v.enabled).reduce((s, v) => s + v.count * v.marksEach, 0);
}

// UI keys (camelCase) ↔ DB/LLM keys (snake_case)
const KEY_TO_DB:   Record<QTypeKey, string>  = { mcq: "mcq", trueFalse: "true_false", fillBlank: "fill_blank", code: "code" };
const KEY_FROM_DB: Record<string, QTypeKey>  = { mcq: "mcq", true_false: "trueFalse", fill_blank: "fillBlank", code: "code" };

function toQConfig(stored: Record<string, { count: number; marksEach: number }> | null | undefined): QConfig {
  if (!stored) return DEFAULT_QCONFIG;
  const result: QConfig = {
    mcq:       { ...DEFAULT_QCONFIG.mcq,       enabled: false },
    trueFalse: { ...DEFAULT_QCONFIG.trueFalse, enabled: false },
    fillBlank: { ...DEFAULT_QCONFIG.fillBlank, enabled: false },
    code:      { ...DEFAULT_QCONFIG.code,      enabled: false },
  };
  for (const [dbKey, val] of Object.entries(stored)) {
    const uiKey = KEY_FROM_DB[dbKey];
    if (uiKey && val) result[uiKey] = { enabled: true, ...val };
  }
  return result;
}

function fromQConfig(qc: QConfig): Record<string, { count: number; marksEach: number }> {
  const out: Record<string, { count: number; marksEach: number }> = {};
  for (const [k, v] of Object.entries(qc) as [QTypeKey, QTypeState][]) {
    if (v.enabled) out[KEY_TO_DB[k]] = { count: v.count, marksEach: v.marksEach };
  }
  return out;
}

interface ExamConfig {
  id: string; title: string; description: string; generatedPrompt: string;
  createdBy: string; isActive: boolean; createdAt: string;
  questionConfig: Record<string, { count: number; marksEach: number }> | null;
  totalMarks: number | null;
}

interface BankQuestion {
  id: string;
  topic: string;
  question: string;
  type: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer: string;
  modelAnswer?: string | null;
}
interface BankSummary { counts: Record<string, number>; total: number; }

type Tab = "dashboard" | "configs" | "users" | "students";

/* ─── Helpers ────────────────────────────────────────────── */
function headers(token: string) {
  return { "Content-Type": "application/json", "x-admin-token": token };
}

/* ═══════════════════════════════════════════════════════════ */
export default function AdminPage() {
  /* Auth */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token,    setToken]    = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authed,   setAuthed]   = useState(false);
  const [authErr,  setAuthErr]  = useState("");

  /* UI */
  const [tab,     setTab]     = useState<Tab>("dashboard");
  const [toast,   setToast]   = useState("");
  const [busy,    setBusy]    = useState<string | null>(null);

  /* Data */
  const [sessions,  setSessions]  = useState<SessionRow[]>([]);
  const [users,     setUsers]     = useState<AdminUser[]>([]);
  const [configs,   setConfigs]   = useState<ExamConfig[]>([]);
  const [studentIds, setStudentIds] = useState<{ studentId: string; teacher: string | null }[]>([]);

  /* Student form */
  const [newStudentId,       setNewStudentId]       = useState("");
  const [newStudentTeacher,  setNewStudentTeacher]  = useState("");
  const [studentBusy,        setStudentBusy]        = useState(false);
  const [studentSearch,      setStudentSearch]      = useState("");
  const [teacherFilter,      setTeacherFilter]      = useState("");
  const [bulkText,           setBulkText]           = useState("");
  const [bulkBusy,           setBulkBusy]           = useState(false);
  const [bulkResult,         setBulkResult]         = useState("");
  const [bulkTeacher,        setBulkTeacher]        = useState("");

  /* Forms */
  const [newUser,     setNewUser]     = useState({ username: "", password: "" });
  const [newConfig,   setNewConfig]   = useState({ title: "", prompt: "", qconfig: DEFAULT_QCONFIG });
  const [configBusy,  setConfigBusy]  = useState(false);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editForm,    setEditForm]    = useState({ title: "", prompt: "", qconfig: DEFAULT_QCONFIG });
  const [editBusy,    setEditBusy]    = useState(false);

  const [bankPanelId,   setBankPanelId]   = useState<string | null>(null);
  const [bankSummary,   setBankSummary]   = useState<Record<string, BankSummary>>({});
  const [bankQuestions, setBankQuestions] = useState<Record<string, Record<string, BankQuestion[]>>>({});
  const [bankViewType,  setBankViewType]  = useState<string | null>(null);
  const [bankGenBusy,   setBankGenBusy]   = useState(false);
  const [bankGenCounts, setBankGenCounts] = useState<Partial<Record<string, number>>>({});

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3500); }

  /* ── Fetch helpers ── */
  const fetchSessions = useCallback(async (t: string) => {
    const res  = await fetch("/api/admin/sessions", { headers: headers(t) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setSessions(data.sessions);
    setIsSuperAdmin(data.isSuperAdmin);
  }, []);

  const fetchUsers = useCallback(async (t: string) => {
    const res  = await fetch("/api/admin/users", { headers: headers(t) });
    if (res.ok) setUsers((await res.json()).users);
  }, []);

  const fetchConfigs = useCallback(async (t: string) => {
    const res  = await fetch("/api/admin/exam-configs", { headers: headers(t) });
    if (res.ok) setConfigs((await res.json()).configs);
  }, []);

  const fetchStudents = useCallback(async (t: string) => {
    const res = await fetch("/api/admin/students", { headers: headers(t) });
    if (res.ok) setStudentIds((await res.json()).students);
  }, []);

  /* ── Login ── */
  async function handleLogin() {
    setAuthErr("");
    const t = username.trim() ? `${username.trim()}:${password}` : password;
    try {
      await fetchSessions(t);
      setToken(t);
      setAuthed(true);
      fetchConfigs(t);
      fetchStudents(t);
      if (isSuperAdmin) fetchUsers(t);
    } catch { setAuthErr("Incorrect credentials."); }
  }

  useEffect(() => {
    if (authed && token) {
      fetchStudents(token);
      if (isSuperAdmin) fetchUsers(token);
    }
  }, [authed, isSuperAdmin, token, fetchUsers, fetchStudents]);

  /* ── Students ── */
  async function addStudent() {
    const id = newStudentId.trim().toUpperCase();
    if (!id) return;
    setStudentBusy(true);
    const body: Record<string, string> = { studentId: id };
    if (isSuperAdmin && newStudentTeacher) body.teacher = newStudentTeacher;
    const res  = await fetch("/api/admin/students", { method: "POST", headers: headers(token), body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) { flash(`Student "${id}" added.`); setNewStudentId(""); fetchStudents(token); }
    else flash(data.error);
    setStudentBusy(false);
  }
  async function deleteStudent(id: string) {
    if (!confirm(`Remove student ID "${id}"?`)) return;
    const res = await fetch("/api/admin/students", { method: "DELETE", headers: headers(token), body: JSON.stringify({ studentId: id }) });
    const data = await res.json();
    if (res.ok) { flash("Student removed."); fetchStudents(token); }
    else flash(data.error);
  }
  async function assignTeacher(studentId: string, teacher: string) {
    const res  = await fetch("/api/admin/students", { method: "PATCH", headers: headers(token), body: JSON.stringify({ studentId, teacher: teacher || null }) });
    const data = await res.json();
    if (res.ok) { flash(`Student "${studentId}" assigned to "${teacher || "none"}".`); fetchStudents(token); }
    else flash(data.error);
  }
  async function bulkUpload(ids: string[]) {
    const cleaned = ids.map((s) => s.trim().toUpperCase()).filter((s) => s.length >= 3);
    if (cleaned.length === 0) return;
    setBulkBusy(true); setBulkResult("");
    const body: Record<string, unknown> = { studentIds: cleaned };
    if (isSuperAdmin && bulkTeacher) body.teacher = bulkTeacher;
    const res  = await fetch("/api/admin/students", { method: "POST", headers: headers(token), body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) { setBulkResult(`✓ ${data.added} IDs uploaded successfully.`); setBulkText(""); fetchStudents(token); }
    else setBulkResult(`✗ ${data.error}`);
    setBulkBusy(false);
  }
  function handleBulkText() {
    const ids = bulkText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    bulkUpload(ids);
  }
  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const ids = text.split(/[\n,;]+/).map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      bulkUpload(ids);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  /* ── Delete Session ── */
  async function deleteSession(id: string, name: string) {
    if (!confirm(`Delete submission by "${name}"? This cannot be undone.`)) return;
    const res  = await fetch("/api/admin/sessions", { method: "DELETE", headers: headers(token), body: JSON.stringify({ id }) });
    const data = await res.json();
    if (res.ok) { flash("Submission deleted."); fetchSessions(token); }
    else flash(data.error);
  }

  /* ── Marksheet ── */
  async function openSessionMarksheet(sessionId: string, examTitle: string) {
    const res  = await fetch(`/api/exam/result/${sessionId}`, { headers: headers(token) });
    if (!res.ok) { flash("Could not load result for marksheet."); return; }
    const data = await res.json();
    openMarksheet(data, examTitle);
  }

  /* ── Announce ── */
  async function announce(mode: "all" | "single", sessionId?: string, visible = true) {
    setBusy(mode === "all" ? "all" : sessionId ?? null);
    const res  = await fetch("/api/admin/announce", { method: "POST", headers: headers(token), body: JSON.stringify({ mode, sessionId, visible }) });
    const data = await res.json();
    flash(data.message ?? (data.success ? "Done!" : data.error));
    await fetchSessions(token);
    setBusy(null);
  }

  /* ── Users ── */
  async function createUser() {
    if (!newUser.username || !newUser.password) return;
    const res  = await fetch("/api/admin/users", { method: "POST", headers: headers(token), body: JSON.stringify(newUser) });
    const data = await res.json();
    if (res.ok) { flash(`User "${newUser.username}" created.`); setNewUser({ username: "", password: "" }); fetchUsers(token); }
    else flash(data.error);
  }
  async function deleteUser(id: string, uname: string) {
    if (!confirm(`Delete user "${uname}"?`)) return;
    await fetch("/api/admin/users", { method: "DELETE", headers: headers(token), body: JSON.stringify({ id }) });
    flash("User deleted."); fetchUsers(token);
  }

  /* ── Exam Configs ── */
  async function createConfig() {
    if (!newConfig.title || !newConfig.prompt) return;
    const total = calcTotal(newConfig.qconfig);
    if (total === 0) { flash("Enable at least one question type."); return; }
    setConfigBusy(true);
    const body = { title: newConfig.title, prompt: newConfig.prompt, totalMarks: total, questionConfig: fromQConfig(newConfig.qconfig) };
    const res  = await fetch("/api/admin/exam-configs", { method: "POST", headers: headers(token), body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) { flash("Config created!"); setNewConfig({ title: "", prompt: "", qconfig: DEFAULT_QCONFIG }); fetchConfigs(token); }
    else flash(data.error);
    setConfigBusy(false);
  }
  async function toggleConfig(id: string, activate: boolean) {
    setBusy(id);
    await fetch(`/api/admin/exam-configs/${id}`, { method: "POST", headers: headers(token), body: JSON.stringify({ activate }) });
    flash(activate ? "Config activated — students can now select this teacher." : "Config deactivated.");
    fetchConfigs(token); setBusy(null);
  }
  async function deleteConfig(id: string) {
    const res  = await fetch(`/api/admin/exam-configs/${id}`, { method: "DELETE", headers: headers(token) });
    const data = await res.json();
    if (res.ok) { flash("Config deleted."); fetchConfigs(token); }
    else flash(data.error);
  }
  function startEdit(c: ExamConfig) {
    setEditingId(c.id);
    setEditForm({ title: c.title, prompt: c.generatedPrompt, qconfig: toQConfig(c.questionConfig) });
    setExpandedId(null);
  }
  async function saveEdit(id: string) {
    if (!editForm.title || !editForm.prompt) return;
    const total = calcTotal(editForm.qconfig);
    if (total === 0) { flash("Enable at least one question type."); return; }
    setEditBusy(true);
    const body = { title: editForm.title, prompt: editForm.prompt, totalMarks: total, questionConfig: fromQConfig(editForm.qconfig) };
    const res  = await fetch(`/api/admin/exam-configs/${id}`, { method: "PATCH", headers: headers(token), body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) { flash("Config updated!"); setEditingId(null); fetchConfigs(token); }
    else flash(data.error);
    setEditBusy(false);
  }

  /* ── Question Bank ── */
  async function fetchBankSummary(configId: string) {
    const res = await fetch(`/api/admin/question-bank/${configId}`, { headers: headers(token) });
    if (res.ok) {
      const data = await res.json();
      setBankSummary((prev) => ({ ...prev, [configId]: data }));
    }
  }

  async function fetchBankType(configId: string, type: string) {
    const res = await fetch(`/api/admin/question-bank/${configId}?type=${type}`, { headers: headers(token) });
    if (res.ok) {
      const data = await res.json();
      setBankQuestions((prev) => ({
        ...prev,
        [configId]: { ...(prev[configId] ?? {}), [type]: data.questions },
      }));
    }
  }

  async function generateBank(configId: string, customCounts: Partial<Record<string, number>>) {
    setBankGenBusy(true);
    const body: Record<string, unknown> = {};
    if (Object.keys(customCounts).length > 0) body.counts = customCounts;
    const res  = await fetch(`/api/admin/question-bank/${configId}/generate`, {
      method: "POST", headers: headers(token), body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      flash(`Bank generated! Added: ${Object.entries(data.added).map(([t, n]) => `${n} ${t}`).join(", ")}`);
      fetchBankSummary(configId);
    } else {
      flash(data.error ?? "Generation failed.");
    }
    setBankGenBusy(false);
  }

  async function deleteBankQuestion(configId: string, id: string, type: string) {
    const res = await fetch(`/api/admin/question-bank/${configId}`, {
      method: "DELETE", headers: headers(token), body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setBankQuestions((prev) => ({
        ...prev,
        [configId]: {
          ...(prev[configId] ?? {}),
          [type]: (prev[configId]?.[type] ?? []).filter((q) => q.id !== id),
        },
      }));
      fetchBankSummary(configId);
      flash("Question deleted.");
    }
  }

  async function clearBank(configId: string) {
    if (!confirm("Delete all questions from this bank? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/question-bank/${configId}`, {
      method: "DELETE", headers: headers(token), body: JSON.stringify({ all: true }),
    });
    if (res.ok) {
      setBankSummary((prev) => ({ ...prev, [configId]: { counts: {}, total: 0 } }));
      setBankQuestions((prev) => ({ ...prev, [configId]: {} }));
      flash("Bank cleared.");
    }
  }

  function openBankPanel(configId: string) {
    if (bankPanelId === configId) {
      setBankPanelId(null);
      setBankViewType(null);
    } else {
      setBankPanelId(configId);
      setBankViewType(null);
      fetchBankSummary(configId);
    }
  }

  /* ══ Stats ══ */
  const announced = sessions.filter((s) => s.resultVisible).length;
  const passed    = sessions.filter((s) => s.score !== null && s.score >= Math.ceil(s.totalMarks * 0.5)).length;
  const avgScore  = sessions.length ? Math.round(sessions.reduce((a, s) => a + (s.score ?? 0), 0) / sessions.length) : 0;
  const activeCount = configs.filter((c) => c.isActive).length;

  /* ════════════════ LOGIN SCREEN ════════════════ */
  if (!authed) return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-2xl font-black text-white">Admin Panel</h1>
          <p className="text-blue-300 text-sm mt-1">MCQ Exam Management</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 space-y-3">
          <div>
            <label className="block text-xs font-bold text-blue-300 mb-1.5 uppercase tracking-wide">Username <span className="text-white/40 font-normal normal-case">(leave blank for super admin)</span></label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="admin username"
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-blue-300 mb-1.5 uppercase tracking-wide">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 text-sm" />
          </div>
          {authErr && <p className="text-red-400 text-sm font-medium">⚠ {authErr}</p>}
          <button onClick={handleLogin} className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all text-sm">
            Login →
          </button>
        </div>
        <div className="text-center mt-4">
          <Link href="/" className="text-blue-400 text-sm hover:text-blue-300">← Back to Home</Link>
        </div>
      </div>
    </main>
  );

  /* ════════════════ MAIN PANEL ════════════════ */
  return (
    <main className="min-h-screen bg-slate-50">
      {toast && (
        <div className="fixed top-4 right-4 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold z-50 border border-white/10">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-blue-950 text-white px-6 py-4 shadow-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black">Admin Panel</h1>
            <p className="text-blue-300 text-xs mt-0.5">
              Logged in as <span className="font-bold text-blue-200">{isSuperAdmin ? "Super Admin" : username}</span>
              {activeCount > 0 && <span className="ml-3 bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded-full border border-green-500/30">{activeCount} active exam{activeCount !== 1 ? "s" : ""}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { fetchSessions(token); fetchConfigs(token); if (isSuperAdmin) { fetchUsers(token); fetchStudents(token); } }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-semibold transition-colors">↺ Refresh</button>
            <button onClick={() => { setAuthed(false); setToken(""); }}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-xs font-semibold text-red-300 transition-colors">Logout</button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 flex gap-1">
          {(["dashboard", "configs", "students", ...(isSuperAdmin ? ["users"] : [])] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-bold capitalize border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {t === "dashboard" ? "📊 Dashboard" : t === "configs" ? "⚙️ Exam Config" : t === "users" ? "👥 Users" : "🎓 Students"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── DASHBOARD TAB ── */}
        {tab === "dashboard" && (<>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Submissions", value: sessions.length, icon: "📋", g: "from-blue-500 to-blue-600"     },
              { label: "Results Announced", value: announced,       icon: "📢", g: "from-green-500 to-emerald-600" },
              { label: "Students Passed",   value: passed,          icon: "✅", g: "from-purple-500 to-purple-600" },
              { label: "Average Score",     value: `${avgScore}/80`,icon: "📊", g: "from-amber-500 to-orange-500"  },
            ].map(({ label, value, icon, g }) => (
              <div key={label} className={`bg-gradient-to-br ${g} text-white rounded-2xl p-4 shadow-sm`}>
                <div className="text-2xl mb-1">{icon}</div>
                <div className="text-2xl font-black">{value}</div>
                <div className="text-xs opacity-80 font-medium mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Announce All */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-slate-900">Announce Results</h2>
              <p className="text-slate-500 text-sm mt-0.5">Make all submitted results visible to students at once.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => announce("all", undefined, false)} disabled={busy !== null}
                className="px-4 py-2 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-50 text-sm transition-colors">Hide All</button>
              <button onClick={() => announce("all", undefined, true)} disabled={busy !== null}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-sm shadow-sm transition-all">
                {busy === "all" ? "Announcing..." : "📢 Announce All"}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h2 className="font-black text-slate-900">Submitted Exams</h2>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{sessions.length} students</span>
              </div>
              {sessions.length > 0 && (
                <button
                  onClick={() => downloadClassReportCSV(sessions, `report_${username}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-indigo-700 text-xs shadow-sm transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  Download Class Report (CSV)
                </button>
              )}
            </div>
            {sessions.length === 0 ? (
              <div className="py-16 text-center"><p className="text-4xl mb-3">📭</p><p className="text-slate-500 font-medium">No submissions yet</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b border-slate-100">
                    {["#", "Student", "Student ID", "Score", "Result", "Status", "Marksheet", "Action", ...(isSuperAdmin ? ["Delete"] : [])].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide text-left">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {sessions.map((s, i) => {
                      const pct      = s.score !== null ? Math.round((s.score / s.totalMarks) * 100) : null;
                      const passScore = Math.ceil(s.totalMarks * 0.5);
                      const ok       = s.score !== null && s.score >= passScore;
                      const examTitle = configs.find((c) => true)?.title ?? "Exam";
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 text-slate-400 font-medium">{i + 1}</td>
                          <td className="px-4 py-3"><p className="font-semibold text-slate-800">{s.studentName}</p>
                            <p className="text-xs text-slate-400">{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "—"}</p></td>
                          <td className="px-4 py-3"><span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{s.studentId ?? "—"}</span></td>
                          <td className="px-4 py-3 text-center"><span className="font-black text-slate-800">{s.score ?? "—"}</span><span className="text-slate-400 text-xs">/{s.totalMarks}</span>
                            {pct !== null && <p className="text-xs text-slate-400">{pct}%</p>}</td>
                          <td className="px-4 py-3 text-center">{s.score !== null
                            ? <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{ok ? "Pass" : "Fail"}</span>
                            : "—"}</td>
                          <td className="px-4 py-3 text-center">{s.resultVisible
                            ? <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 bg-green-500 rounded-full" />Announced</span>
                            : <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />Pending</span>}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => openSessionMarksheet(s.id, examTitle)}
                              className="px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-100 transition-colors">
                              📄 Marksheet
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => announce("single", s.id, !s.resultVisible)} disabled={busy !== null}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${s.resultVisible ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-sm"}`}>
                              {busy === s.id ? "..." : s.resultVisible ? "Hide" : "Announce"}
                            </button>
                          </td>
                          {isSuperAdmin && (
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => deleteSession(s.id, s.studentName)}
                                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>)}

        {/* ── EXAM CONFIG TAB ── */}
        {tab === "configs" && (<>
          {/* Create */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-black text-slate-900 mb-1">Create Exam Configuration</h2>
            <p className="text-slate-500 text-sm mb-5">Write your exam instructions directly — this prompt will guide AI question generation.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Config Title</label>
                <input type="text" value={newConfig.title} onChange={(e) => setNewConfig((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Python Advanced Exam"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-slate-900 text-sm transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Exam Prompt</label>
                <textarea value={newConfig.prompt} onChange={(e) => setNewConfig((p) => ({ ...p, prompt: e.target.value }))} rows={6}
                  placeholder="e.g. Focus on code-tracing questions. Include more OOP scenarios with inheritance. Test practical Python skills rather than definitions. Make questions challenging but fair."
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-slate-900 text-sm resize-none transition-colors" />
                <p className="text-xs text-slate-400 mt-1">This will be injected directly into the AI question generator.</p>
              </div>
              {/* Question Type Config */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Question Types & Marks</label>
                <div className="space-y-2">
                  {QTYPES.map(({ key, label, icon }) => {
                    const qt = newConfig.qconfig[key];
                    return (
                      <div key={key} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${qt.enabled ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-slate-50/30"}`}>
                        <input type="checkbox" checked={qt.enabled}
                          onChange={(e) => setNewConfig((p) => ({ ...p, qconfig: { ...p.qconfig, [key]: { ...qt, enabled: e.target.checked } } }))}
                          className="w-4 h-4 accent-blue-600 cursor-pointer flex-shrink-0" />
                        <span className="text-xs font-mono font-bold text-slate-400 w-8 flex-shrink-0">{icon}</span>
                        <span className={`text-sm font-semibold flex-1 ${qt.enabled ? "text-slate-800" : "text-slate-400"}`}>{label}</span>
                        {qt.enabled && (<>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">Count</span>
                            <input type="number" min={1} max={200} value={qt.count}
                              onChange={(e) => setNewConfig((p) => ({ ...p, qconfig: { ...p.qconfig, [key]: { ...qt, count: Math.max(1, parseInt(e.target.value) || 1) } } }))}
                              className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-center font-bold focus:border-blue-400 focus:outline-none" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">Marks each</span>
                            <input type="number" min={1} max={20} value={qt.marksEach}
                              onChange={(e) => setNewConfig((p) => ({ ...p, qconfig: { ...p.qconfig, [key]: { ...qt, marksEach: Math.max(1, parseInt(e.target.value) || 1) } } }))}
                              className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 text-sm text-center font-bold focus:border-blue-400 focus:outline-none" />
                          </div>
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-lg w-20 text-center flex-shrink-0">
                            = {qt.count * qt.marksEach}
                          </span>
                        </>)}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between px-4 py-2.5 bg-slate-900 rounded-xl">
                  <span className="text-xs font-semibold text-slate-400">Total Marks</span>
                  <span className="text-base font-black text-white">{calcTotal(newConfig.qconfig)}</span>
                </div>
              </div>

              <button onClick={createConfig} disabled={configBusy || !newConfig.title || !newConfig.prompt}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-all shadow-sm">
                {configBusy ? "Saving..." : "Save Config"}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-900">Saved Configurations</h2>
              <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{configs.length} configs</span>
            </div>
            {configs.length === 0 ? (
              <div className="py-12 text-center"><p className="text-3xl mb-2">⚙️</p><p className="text-slate-500 text-sm">No configurations yet. Create one above.</p></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {configs.map((c) => (
                  <div key={c.id} className="p-5">
                    {editingId === c.id ? (
                      /* ── Inline Edit Form ── */
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Title</label>
                          <input type="text" value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl border-2 border-blue-300 focus:border-blue-500 focus:outline-none text-slate-900 text-sm transition-colors" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Exam Prompt</label>
                          <textarea value={editForm.prompt} onChange={(e) => setEditForm((p) => ({ ...p, prompt: e.target.value }))} rows={6}
                            className="w-full px-3 py-2 rounded-xl border-2 border-blue-300 focus:border-blue-500 focus:outline-none text-slate-900 text-sm resize-none transition-colors" />
                        </div>
                        {/* Question Type Config */}
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Question Types & Marks</label>
                          <div className="space-y-2">
                            {QTYPES.map(({ key, label, icon }) => {
                              const qt = editForm.qconfig[key];
                              return (
                                <div key={key} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all ${qt.enabled ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-slate-50/30"}`}>
                                  <input type="checkbox" checked={qt.enabled}
                                    onChange={(e) => setEditForm((p) => ({ ...p, qconfig: { ...p.qconfig, [key]: { ...qt, enabled: e.target.checked } } }))}
                                    className="w-4 h-4 accent-blue-600 cursor-pointer flex-shrink-0" />
                                  <span className="text-xs font-mono font-bold text-slate-400 w-8 flex-shrink-0">{icon}</span>
                                  <span className={`text-xs font-semibold flex-1 ${qt.enabled ? "text-slate-800" : "text-slate-400"}`}>{label}</span>
                                  {qt.enabled && (<>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-slate-400">Count</span>
                                      <input type="number" min={1} max={200} value={qt.count}
                                        onChange={(e) => setEditForm((p) => ({ ...p, qconfig: { ...p.qconfig, [key]: { ...qt, count: Math.max(1, parseInt(e.target.value) || 1) } } }))}
                                        className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-xs text-center font-bold focus:border-blue-400 focus:outline-none" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-slate-400">Marks</span>
                                      <input type="number" min={1} max={20} value={qt.marksEach}
                                        onChange={(e) => setEditForm((p) => ({ ...p, qconfig: { ...p.qconfig, [key]: { ...qt, marksEach: Math.max(1, parseInt(e.target.value) || 1) } } }))}
                                        className="w-12 px-2 py-1 rounded-lg border border-slate-200 text-xs text-center font-bold focus:border-blue-400 focus:outline-none" />
                                    </div>
                                    <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-lg w-16 text-center flex-shrink-0">
                                      = {qt.count * qt.marksEach}
                                    </span>
                                  </>)}
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-2 flex items-center justify-between px-3 py-2 bg-slate-900 rounded-xl">
                            <span className="text-xs font-semibold text-slate-400">Total Marks</span>
                            <span className="font-black text-white">{calcTotal(editForm.qconfig)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(c.id)} disabled={editBusy || !editForm.title || !editForm.prompt}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-xs transition-all flex items-center gap-1.5">
                            {editBusy && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {editBusy ? "Saving..." : "Save Changes"}
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="px-4 py-2 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-xs transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Normal View ── */
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-bold text-slate-900">{c.title}</h3>
                              {c.isActive && <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-green-200">● Active</span>}
                            </div>
                            <p className="text-xs text-slate-400">Created by {c.createdBy} · {new Date(c.createdAt).toLocaleDateString()}</p>
                            {c.questionConfig && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {QTYPES.filter(({ key }) => (c.questionConfig as Record<string, unknown>)?.[key]).map(({ key, label }) => {
                                  const qt = (c.questionConfig as Record<string, { count: number; marksEach: number }>)[key];
                                  return (
                                    <span key={key} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                      {qt.count} {label} × {qt.marksEach}m
                                    </span>
                                  );
                                })}
                                {c.totalMarks && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{c.totalMarks} total marks</span>}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                            <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                              {expandedId === c.id ? "Hide" : "View"} Prompt
                            </button>
                            <button onClick={() => startEdit(c)}
                              className="px-3 py-1.5 border border-blue-200 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors">
                              Edit
                            </button>
                            <button onClick={() => toggleConfig(c.id, !c.isActive)} disabled={busy === c.id}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${c.isActive ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-sm"}`}>
                              {busy === c.id ? "..." : c.isActive ? "Deactivate" : "Activate"}
                            </button>
                            {!c.isActive && (
                              <button onClick={() => deleteConfig(c.id)}
                                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">Delete</button>
                            )}
                            <button onClick={() => openBankPanel(c.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${bankPanelId === c.id ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                              🗃 Bank
                            </button>
                          </div>
                        </div>
                        {expandedId === c.id && (
                          <div className="mt-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Exam Prompt</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{c.generatedPrompt}</p>
                          </div>
                        )}
                        {bankPanelId === c.id && (() => {
                          const summary = bankSummary[c.id];
                          const qcfg = (c.questionConfig as Record<string, { count: number; marksEach: number }> | null) ?? {};
                          const enabledTypes = Object.keys(qcfg).filter(t => ["mcq","true_false","fill_blank","code"].includes(t));
                          const TYPE_LABELS: Record<string, string> = { mcq: "MCQ", true_false: "True/False", fill_blank: "Fill Blank", code: "Code" };

                          return (
                            <div className="mt-3 border border-violet-200 rounded-xl bg-violet-50/30 p-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">Question Bank</p>
                                <div className="flex gap-2">
                                  {summary && summary.total > 0 && (
                                    <button onClick={() => clearBank(c.id)}
                                      className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-colors">
                                      Clear All
                                    </button>
                                  )}
                                  <button onClick={() => generateBank(c.id, bankGenCounts)} disabled={bankGenBusy}
                                    className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                                    {bankGenBusy && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {bankGenBusy ? "Generating..." : summary && summary.total > 0 ? "Add More" : "Generate Bank"}
                                  </button>
                                </div>
                              </div>

                              {/* Custom counts form */}
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {enabledTypes.map((typeKey) => {
                                  const def = ({ mcq: 200, true_false: 200, fill_blank: 100, code: 100 } as Record<string, number>)[typeKey] ?? 100;
                                  return (
                                    <div key={typeKey} className="bg-white rounded-lg border border-slate-200 p-2.5">
                                      <p className="text-xs text-slate-500 font-medium mb-1">{TYPE_LABELS[typeKey] ?? typeKey}</p>
                                      <div className="flex items-center gap-1">
                                        <input type="number" min={10} max={500}
                                          placeholder={String(def)}
                                          value={bankGenCounts[typeKey] ?? ""}
                                          onChange={(e) => setBankGenCounts(p => ({ ...p, [typeKey]: parseInt(e.target.value) || def }))}
                                          className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs text-center font-bold focus:border-violet-400 focus:outline-none"
                                        />
                                        <span className="text-xs text-slate-400">qs</span>
                                      </div>
                                      {summary && (
                                        <p className={`text-xs font-bold mt-1 ${(summary.counts[typeKey] ?? 0) > 0 ? "text-green-600" : "text-slate-400"}`}>
                                          {summary.counts[typeKey] ?? 0} in bank
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Status bar */}
                              {!summary && <p className="text-xs text-slate-400 text-center">Loading bank stats...</p>}
                              {summary && summary.total === 0 && (
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-center">
                                  No questions in bank yet. Generate one for instant exam starts.
                                </p>
                              )}
                              {summary && summary.total > 0 && (
                                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center font-medium">
                                  ✓ {summary.total} questions in bank — students get instant exam starts
                                </p>
                              )}

                              {/* Per-type question viewer */}
                              {summary && summary.total > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">View / Delete Questions</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {enabledTypes.filter(t => (summary.counts[t] ?? 0) > 0).map((typeKey) => (
                                      <button key={typeKey}
                                        onClick={() => {
                                          const next = bankViewType === typeKey ? null : typeKey;
                                          setBankViewType(next);
                                          if (next) fetchBankType(c.id, typeKey);
                                        }}
                                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${bankViewType === typeKey ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                                        {TYPE_LABELS[typeKey] ?? typeKey} ({summary.counts[typeKey]})
                                      </button>
                                    ))}
                                  </div>

                                  {bankViewType && bankQuestions[c.id]?.[bankViewType] && (
                                    <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
                                      {bankQuestions[c.id][bankViewType].map((q) => (
                                        <div key={q.id} className="flex items-start gap-3 px-3 py-2.5">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-500 mb-0.5">{q.topic}</p>
                                            <p className="text-xs text-slate-800 leading-snug">{q.question}</p>
                                          </div>
                                          <button onClick={() => deleteBankQuestion(c.id, q.id, bankViewType)}
                                            className="text-red-400 hover:text-red-600 text-xs flex-shrink-0 p-1 hover:bg-red-50 rounded transition-colors">
                                            ✕
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {bankViewType && !bankQuestions[c.id]?.[bankViewType] && (
                                    <p className="text-xs text-slate-400 text-center py-3">Loading...</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>)}

        {/* ── STUDENTS TAB ── */}
        {tab === "students" && (() => {
          const allTeachers = [...new Set(studentIds.map((s) => s.teacher).filter(Boolean))] as string[];
          const filtered = studentIds.filter((s) => {
            const matchId      = s.studentId.toLowerCase().includes(studentSearch.toLowerCase());
            const matchTeacher = !teacherFilter || s.teacher === teacherFilter;
            return matchId && matchTeacher;
          });

          return (<>
            {/* Add Student */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-black text-slate-900 mb-1">Add Student</h2>
              <p className="text-slate-500 text-sm mb-4">
                {isSuperAdmin ? "Register a student and assign them to a teacher." : `Students you add will be assigned to you (${username}) automatically.`}
              </p>
              <div className="flex gap-3 flex-wrap">
                <input
                  type="text"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && !studentBusy && addStudent()}
                  placeholder="e.g. AIT25-AI12-0001"
                  className="flex-1 min-w-[180px] px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-slate-900 font-mono text-sm tracking-wide transition-colors"
                />
                {isSuperAdmin && (
                  <select
                    value={newStudentTeacher}
                    onChange={(e) => setNewStudentTeacher(e.target.value)}
                    className="px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-slate-700 text-sm transition-colors bg-white"
                  >
                    <option value="">-- No teacher --</option>
                    {users.map((u) => <option key={u.id} value={u.username}>{u.username}</option>)}
                  </select>
                )}
                <button onClick={addStudent} disabled={studentBusy || !newStudentId.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-sm shadow-sm transition-all flex items-center gap-2">
                  {studentBusy && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  + Add
                </button>
              </div>
            </div>

            {/* Bulk Upload */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-black text-slate-900 mb-1">Bulk Upload</h2>
              <p className="text-slate-500 text-sm mb-4">Paste multiple IDs (one per line or comma-separated), or upload a CSV file.</p>
              <div className="space-y-3">
                {isSuperAdmin && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Assign Teacher (optional)</label>
                    <select
                      value={bulkTeacher}
                      onChange={(e) => setBulkTeacher(e.target.value)}
                      className="px-3 py-2 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-slate-700 text-sm transition-colors bg-white"
                    >
                      <option value="">-- No teacher --</option>
                      {users.map((u) => <option key={u.id} value={u.username}>{u.username}</option>)}
                    </select>
                  </div>
                )}
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={5}
                  placeholder={"AIT25-AI12-0001\nAIT25-AI12-0002\nAIT25-AI12-0003\n..."}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-slate-900 font-mono text-sm resize-none transition-colors"
                />
                <div className="flex flex-wrap gap-3 items-center">
                  <button onClick={handleBulkText} disabled={bulkBusy || !bulkText.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-sm shadow-sm transition-all flex items-center gap-2">
                    {bulkBusy && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {bulkBusy ? "Uploading..." : "Upload IDs"}
                  </button>
                  <label className="px-5 py-2.5 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:border-blue-400 hover:text-blue-600 cursor-pointer text-sm transition-colors">
                    📂 Upload CSV
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} />
                  </label>
                  <span className="text-xs text-slate-400">Duplicates skipped automatically</span>
                </div>
                {bulkResult && (
                  <p className={`text-sm font-semibold px-4 py-2.5 rounded-xl ${bulkResult.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {bulkResult}
                  </p>
                )}
              </div>
            </div>

            {/* Student List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="font-black text-slate-900">Registered Students</h2>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{filtered.length} / {studentIds.length}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value.toUpperCase())}
                    placeholder="Search ID..."
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:border-blue-400 w-40 transition-colors"
                  />
                  {isSuperAdmin && (
                    <select
                      value={teacherFilter}
                      onChange={(e) => setTeacherFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400 bg-white transition-colors"
                    >
                      <option value="">All teachers</option>
                      <option value="">-- Unassigned --</option>
                      {allTeachers.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">🎓</p>
                  <p className="text-slate-500 text-sm">{studentIds.length === 0 ? "No students registered yet." : "No results found."}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide text-left">#</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide text-left">Student ID</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide text-left">Teacher</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtered.map((s, i) => (
                        <tr key={s.studentId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 text-slate-400 font-medium">{i + 1}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg text-xs">{s.studentId}</span>
                          </td>
                          <td className="px-4 py-3">
                            {isSuperAdmin ? (
                              <select
                                defaultValue={s.teacher ?? ""}
                                onChange={(e) => assignTeacher(s.studentId, e.target.value)}
                                className="px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:border-blue-400 transition-colors"
                              >
                                <option value="">-- none --</option>
                                {users.map((u) => <option key={u.id} value={u.username}>{u.username}</option>)}
                              </select>
                            ) : (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.teacher ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-400"}`}>
                                {s.teacher ?? "unassigned"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => deleteStudent(s.studentId)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>);
        })()}

        {/* ── USERS TAB (super admin only) ── */}
        {tab === "users" && isSuperAdmin && (<>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-black text-slate-900 mb-1">Create Admin User</h2>
            <p className="text-slate-500 text-sm mb-5">Sub-admins can log in and create exam configurations.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Username</label>
                <input type="text" value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                  placeholder="e.g. teacher1"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-slate-900 text-sm transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Password</label>
                <input type="text" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                  placeholder="min 4 characters"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-slate-900 text-sm transition-colors" />
              </div>
            </div>
            <button onClick={createUser} disabled={!newUser.username || !newUser.password}
              className="mt-4 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-sm shadow-sm transition-all">
              + Create User
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-black text-slate-900">Admin Users</h2>
            </div>
            {users.length === 0 ? (
              <div className="py-12 text-center"><p className="text-3xl mb-2">👥</p><p className="text-slate-500 text-sm">No sub-admins yet.</p></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {users.map((u) => (
                  <div key={u.id} className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{u.username}</p>
                      <p className="text-xs text-slate-400">Created {new Date(u.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => deleteUser(u.id, u.username)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>)}
      </div>
    </main>
  );
}
