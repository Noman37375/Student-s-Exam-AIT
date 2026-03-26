"use client";

import { useState } from "react";
import Link from "next/link";
import ResultSummary from "@/components/ResultSummary";
import AnswerReview from "@/components/AnswerReview";
import PrintButton from "@/components/PrintButton";
import { openMarksheet } from "@/lib/marksheet";
import type { ExamResult } from "@/types/exam";

type PortalState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "not_found"; message: string }
  | { status: "pending"; studentName: string }
  | { status: "result"; data: ExamResult };

export default function PortalPage() {
  const [studentId, setStudentId] = useState("");
  const [state, setState]         = useState<PortalState>({ status: "idle" });

  async function handleCheck() {
    const id = studentId.trim().toUpperCase();
    if (!id) return;
    setState({ status: "loading" });
    try {
      const res  = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: id }),
      });
      const data = await res.json();
      if (!res.ok) { setState({ status: "not_found", message: data.error }); return; }
      if (!data.announced) { setState({ status: "pending", studentName: data.studentName }); return; }
      setState({ status: "result", data });
    } catch {
      setState({ status: "not_found", message: "Network error. Please try again." });
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-200">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Student Portal</h1>
          <p className="text-slate-500 mt-1 text-sm">Check your exam result using your Student ID</p>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Student ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={studentId}
              onChange={(e) => { setStudentId(e.target.value.toUpperCase()); setState({ status: "idle" }); }}
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              placeholder="e.g. AIT25-AI12-0374"
              className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none font-mono tracking-wide text-slate-900 placeholder-slate-400 text-sm"
            />
            <button
              onClick={handleCheck}
              disabled={state.status === "loading" || !studentId.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm min-w-[80px] flex items-center justify-center"
            >
              {state.status === "loading"
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : "Check"}
            </button>
          </div>
        </div>

        {/* Not found */}
        {state.status === "not_found" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-semibold text-red-700 text-sm">{state.message}</p>
            <p className="text-red-400 text-xs mt-1">Make sure you have completed your exam first.</p>
          </div>
        )}

        {/* Pending */}
        {state.status === "pending" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Result Not Yet Announced</h2>
            <p className="text-slate-500 text-sm">Hello, <strong className="text-slate-700">{state.studentName}</strong></p>
            <p className="text-slate-400 text-sm mt-0.5">Your exam was submitted. Your instructor will announce results soon.</p>
            <div className="mt-4 inline-block bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-amber-700 text-xs font-medium">
              Please check back later
            </div>
          </div>
        )}

        {/* Result */}
        {state.status === "result" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">{state.data.studentName.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{state.data.studentName}</p>
                <p className="text-blue-600 font-mono text-xs font-semibold">{state.data.studentId}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-slate-400">Submitted</p>
                <p className="text-xs text-slate-600 font-medium">
                  {state.data.submittedAt ? new Date(state.data.submittedAt).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>

            <ResultSummary result={state.data} />
            <AnswerReview questions={state.data.questions} />

            <div className="flex gap-3 justify-center pb-4 flex-wrap">
              <button onClick={() => setState({ status: "idle" })}
                className="inline-flex items-center gap-2 px-6 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Check Another
              </button>
              <button
                onClick={() => openMarksheet(state.data, "Exam")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-green-700 shadow-sm text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Download Marksheet
              </button>
              <PrintButton />
            </div>
          </div>
        )}

        <div className="text-center mt-6">
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 inline-flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
