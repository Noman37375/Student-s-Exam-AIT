"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────── */
interface SessionRow { id: string; studentName: string; studentId: string | null; score: number | null; totalMarks: number; submittedAt: string | null; resultVisible: boolean; }
interface AdminUser   { id: string; username: string; createdAt: string; }
interface ExamConfig  { id: string; title: string; description: string; generatedPrompt: string; createdBy: string; isActive: boolean; createdAt: string; }

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
  const [studentIds, setStudentIds] = useState<{ studentId: string }[]>([]);

  /* Student form */
  const [newStudentId,   setNewStudentId]   = useState("");
  const [studentBusy,    setStudentBusy]    = useState(false);
  const [studentSearch,  setStudentSearch]  = useState("");
  const [bulkText,       setBulkText]       = useState("");
  const [bulkBusy,       setBulkBusy]       = useState(false);
  const [bulkResult,     setBulkResult]     = useState("");

  /* Forms */
  const [newUser,     setNewUser]     = useState({ username: "", password: "" });
  const [newConfig,   setNewConfig]   = useState({ title: "", prompt: "" });
  const [configBusy,  setConfigBusy]  = useState(false);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editForm,    setEditForm]    = useState({ title: "", prompt: "" });
  const [editBusy,    setEditBusy]    = useState(false);

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
      if (isSuperAdmin) { fetchUsers(t); fetchStudents(t); }
    } catch { setAuthErr("Incorrect credentials."); }
  }

  useEffect(() => {
    if (authed && isSuperAdmin && token) { fetchUsers(token); fetchStudents(token); }
  }, [authed, isSuperAdmin, token, fetchUsers, fetchStudents]);

  /* ── Students ── */
  async function addStudent() {
    const id = newStudentId.trim().toUpperCase();
    if (!id) return;
    setStudentBusy(true);
    const res  = await fetch("/api/admin/students", { method: "POST", headers: headers(token), body: JSON.stringify({ studentId: id }) });
    const data = await res.json();
    if (res.ok) { flash(`Student "${id}" added.`); setNewStudentId(""); fetchStudents(token); }
    else flash(data.error);
    setStudentBusy(false);
  }
  async function deleteStudent(id: string) {
    if (!confirm(`Remove student ID "${id}"?`)) return;
    await fetch("/api/admin/students", { method: "DELETE", headers: headers(token), body: JSON.stringify({ studentId: id }) });
    flash("Student removed."); fetchStudents(token);
  }
  async function bulkUpload(ids: string[]) {
    const cleaned = ids.map((s) => s.trim().toUpperCase()).filter((s) => s.length >= 3);
    if (cleaned.length === 0) return;
    setBulkBusy(true); setBulkResult("");
    const res  = await fetch("/api/admin/students", { method: "POST", headers: headers(token), body: JSON.stringify({ studentIds: cleaned }) });
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
    setConfigBusy(true);
    const res  = await fetch("/api/admin/exam-configs", { method: "POST", headers: headers(token), body: JSON.stringify(newConfig) });
    const data = await res.json();
    if (res.ok) { flash("Config created!"); setNewConfig({ title: "", prompt: "" }); fetchConfigs(token); }
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
    setEditForm({ title: c.title, prompt: c.generatedPrompt });
    setExpandedId(null);
  }
  async function saveEdit(id: string) {
    if (!editForm.title || !editForm.prompt) return;
    setEditBusy(true);
    const res  = await fetch(`/api/admin/exam-configs/${id}`, { method: "PATCH", headers: headers(token), body: JSON.stringify(editForm) });
    const data = await res.json();
    if (res.ok) { flash("Config updated!"); setEditingId(null); fetchConfigs(token); }
    else flash(data.error);
    setEditBusy(false);
  }

  /* ══ Stats ══ */
  const announced = sessions.filter((s) => s.resultVisible).length;
  const passed    = sessions.filter((s) => s.score !== null && s.score >= 25).length;
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
          {(["dashboard", "configs", ...(isSuperAdmin ? ["users", "students"] : [])] as Tab[]).map((t) => (
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
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-900">Submitted Exams</h2>
              <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{sessions.length} students</span>
            </div>
            {sessions.length === 0 ? (
              <div className="py-16 text-center"><p className="text-4xl mb-3">📭</p><p className="text-slate-500 font-medium">No submissions yet</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b border-slate-100">
                    {["#", "Student", "Student ID", "Score", "Result", "Status", "Action", ...(isSuperAdmin ? ["Delete"] : [])].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide text-left">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {sessions.map((s, i) => {
                      const pct = s.score !== null ? Math.round((s.score / s.totalMarks) * 100) : null;
                      const ok  = s.score !== null && s.score >= 25;
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
              <button onClick={createConfig} disabled={configBusy || !newConfig.title || !newConfig.prompt}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-all shadow-sm">
                Save Config
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
                          </div>
                        </div>
                        {expandedId === c.id && (
                          <div className="mt-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Exam Prompt</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{c.generatedPrompt}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>)}

        {/* ── STUDENTS TAB (super admin only) ── */}
        {tab === "students" && isSuperAdmin && (() => {
          const filtered = studentIds.filter((s) =>
            s.studentId.toLowerCase().includes(studentSearch.toLowerCase())
          );
          return (<>
            {/* Add Student */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-black text-slate-900 mb-1">Add Student ID</h2>
              <p className="text-slate-500 text-sm mb-4">Only registered IDs can take the exam.</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && !studentBusy && addStudent()}
                  placeholder="e.g. AIT25-AI12-0001"
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-slate-900 font-mono text-sm tracking-wide transition-colors"
                />
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
                  <span className="text-xs text-slate-400">Supports .csv or .txt — duplicates are skipped automatically</span>
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
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="font-black text-slate-900">Registered Students</h2>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{studentIds.length} total</span>
                </div>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value.toUpperCase())}
                  placeholder="Search ID..."
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:border-blue-400 w-44 transition-colors"
                />
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
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtered.map((s, i) => (
                        <tr key={s.studentId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 text-slate-400 font-medium">{i + 1}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg text-xs">
                              {s.studentId}
                            </span>
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
