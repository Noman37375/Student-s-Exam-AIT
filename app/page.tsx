"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Step = "idle" | "validating" | "generating" | "done" | "error";

interface ExamConfig {
  id:        string;
  title:     string;
  createdBy: string;
}

export default function StartPage() {
  const [configs,        setConfigs]       = useState<ExamConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [selectedConfig, setSelectedConfig] = useState<ExamConfig | null>(null);

  const [studentName, setStudentName] = useState("");
  const [studentId,   setStudentId]   = useState("");
  const [step,        setStep]        = useState<Step>("idle");
  const [error,       setError]       = useState("");

  const loading = step === "validating" || step === "generating";

  useEffect(() => {
    fetch("/api/exam/configs")
      .then((r) => r.json())
      .then((d) => setConfigs(d.configs ?? []))
      .catch(() => setConfigs([]))
      .finally(() => setConfigsLoading(false));
  }, []);

  async function handleStart() {
    const name = studentName.trim();
    const id   = studentId.trim().toUpperCase();

    if (!selectedConfig) {
      setError("Please select a teacher first.");
      return;
    }
    if (name.length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }
    if (!id) {
      setError("Please enter your Student ID.");
      return;
    }

    setError("");
    setStep("validating");

    try {
      setStep("generating");

      const res = await fetch("/api/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: name, studentId: id, configId: selectedConfig.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.alreadySubmitted) {
          setStep("done");
          window.location.href = `/result/${data.sessionId}`;
          return;
        }
        throw new Error(data.error ?? `Server error ${res.status}`);
      }

      setStep("done");
      try {
        sessionStorage.setItem(`exam_${data.sessionId}`, JSON.stringify(data));
      } catch { /* ignore */ }

      window.location.href = `/exam/${data.sessionId}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error occurred.";
      setError(msg);
      setStep("error");
    }
  }

  const stepLabel: Record<Step, string> = {
    idle:       "Start Exam →",
    validating: "Checking ID...",
    generating: "AI Generating Questions...",
    done:       "Redirecting...",
    error:      "Try Again",
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">📝</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900">MCQ Exam</h1>
          <p className="text-gray-500 mt-1">AI-Powered Dynamic Assessment</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Questions", value: "40"     },
            { label: "Marks",     value: "80"     },
            { label: "Duration",  value: "60 min" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
              <div className="text-xl font-black text-blue-600">{value}</div>
              <div className="text-xs text-gray-500 font-medium">{label}</div>
            </div>
          ))}
        </div>

        {/* Step 1 — Select Teacher */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Select Teacher</h2>
          </div>

          {configsLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
              <span className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm">Loading available exams...</span>
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-amber-600 text-sm font-semibold">No exams available yet.</p>
              <p className="text-gray-400 text-xs mt-1">Please contact your administrator.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {configs.map((cfg) => {
                const isSelected = selectedConfig?.id === cfg.id;
                return (
                  <button
                    key={cfg.id}
                    onClick={() => { setSelectedConfig(cfg); setError(""); }}
                    disabled={loading}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-150 flex items-center gap-3 ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                      isSelected ? "bg-blue-600 text-white" : "bg-white border-2 border-gray-200 text-gray-500"
                    }`}>
                      {cfg.createdBy.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isSelected ? "text-blue-900" : "text-gray-800"}`}>
                        {cfg.createdBy}
                      </p>
                      <p className={`text-xs truncate ${isSelected ? "text-blue-600" : "text-gray-400"}`}>
                        {cfg.title}
                      </p>
                    </div>
                    {isSelected && (
                      <svg className="w-5 h-5 text-blue-500 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 2 — Student Info + Submit */}
        <div className={`bg-white rounded-2xl p-6 shadow-sm border transition-all duration-300 space-y-4 ${
          selectedConfig ? "border-gray-100 opacity-100" : "border-gray-100 opacity-50 pointer-events-none"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Enter Your Details</h2>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleStart()}
              placeholder="e.g. Ahmed Khan"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-gray-900 placeholder-gray-400 transition-colors disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Student ID</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleStart()}
              placeholder="e.g. AIT25-AI12-0374"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-gray-900 placeholder-gray-400 font-mono tracking-wide transition-colors disabled:bg-gray-50"
            />
            <p className="text-xs text-gray-400 mt-1">Format: AIT25-AI12-XXXX</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-100 border-2 border-red-400 rounded-xl px-4 py-3 text-red-800 text-sm font-bold">
              ⚠️ {error}
            </div>
          )}

          {/* Loading steps */}
          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-2">
              {[
                { s: "validating", label: "Validating Student ID" },
                { s: "generating", label: "AI generating 40 unique questions (15–20s)" },
              ].map(({ s, label }) => {
                const steps: Step[] = ["validating", "generating", "done"];
                const current = steps.indexOf(step);
                const idx = steps.indexOf(s as Step);
                const done = current > idx;
                const active = current === idx;
                return (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    {done ? (
                      <span className="text-green-600 font-bold">✓</span>
                    ) : active ? (
                      <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-gray-300 inline-block" />
                    )}
                    <span className={active ? "text-blue-700 font-semibold" : done ? "text-green-700" : "text-gray-400"}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            disabled={loading || !selectedConfig}
            onClick={handleStart}
            className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {stepLabel[step]}
          </button>
        </div>

        {/* Quick links — only Student Portal */}
        <div className="mt-4">
          <Link
            href="/portal"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:border-blue-300 hover:text-blue-600 text-sm transition-colors"
          >
            🎓 Student Portal
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Each exam is uniquely generated by AI • Questions never repeat
        </p>
      </div>
    </main>
  );
}
