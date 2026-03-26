"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import ExamCard from "@/components/ExamCard";
import ExamNav from "@/components/ExamNav";
import ExamTimer from "@/components/ExamTimer";
import type { ExamQuestion, AnswerOption, ExamSession } from "@/types/exam";

export default function ExamPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session,      setSession]      = useState<ExamSession | null>(null);
  const [loadError,    setLoadError]    = useState("");
  const [answers,      setAnswers]      = useState<Record<string, AnswerOption>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState("");
  const [showConfirm,  setShowConfirm]  = useState(false);

  useEffect(() => {
    async function loadSession() {
      try {
        const stored = sessionStorage.getItem(`exam_${sessionId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.questions?.length > 0) { setSession(parsed); return; }
        }
      } catch { /* fall through */ }

      try {
        const res  = await fetch(`/api/exam/session/${sessionId}`);
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 409) { window.location.replace(`/result/${sessionId}`); return; }
          setLoadError(data.error ?? "Failed to load exam.");
          return;
        }
        setSession(data);
      } catch {
        setLoadError("Network error. Please refresh the page.");
      }
    }
    loadSession();
  }, [sessionId]);

  const submitExam = useCallback(async (forced = false) => {
    if (submitting) return;
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const res  = await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed.");
      try { sessionStorage.removeItem(`exam_${sessionId}`); } catch { /* ignore */ }
      window.location.href = `/submitted`;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
      if (!forced) setSubmitting(false);
    }
  }, [sessionId, answers, submitting]);

  const handleTimerExpire = useCallback(() => { submitExam(true); }, [submitExam]);

  if (!session && !loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-medium">Loading your exam...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-4">
        <div className="text-5xl">⚠️</div>
        <p className="text-red-600 font-semibold text-center max-w-sm">{loadError}</p>
        <button onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
          Retry
        </button>
        <button onClick={() => { window.location.href = "/"; }}
          className="text-sm text-slate-400 hover:text-slate-600 underline">
          Back to Home
        </button>
      </div>
    );
  }

  const { questions, durationMinutes } = session!;
  const currentQuestion: ExamQuestion = questions[currentIndex];
  const answeredCount  = Object.keys(answers).length;
  const allAnswered    = answeredCount === questions.length;
  const remaining      = questions.length - answeredCount;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Student info */}
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">
                {session!.studentName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 text-sm truncate leading-tight">{session!.studentName}</p>
              {session!.studentId && (
                <p className="text-xs text-blue-600 font-mono font-semibold leading-tight">{session!.studentId}</p>
              )}
            </div>
          </div>

          <ExamTimer durationMinutes={durationMinutes} onExpire={handleTimerExpire} />

          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Answered</p>
            <p className="font-bold text-slate-800">
              {answeredCount}
              <span className="text-slate-400 font-normal text-sm">/{questions.length}</span>
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Question card */}
          <div className="lg:col-span-2">
            <ExamCard
              question={currentQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={questions.length}
              selectedAnswer={answers[currentQuestion.id] ?? null}
              onAnswer={(ans) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: ans }))}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <ExamNav
              currentIndex={currentIndex}
              totalQuestions={questions.length}
              answers={answers}
              questionIds={questions.map((q) => q.id)}
              onNavigate={setCurrentIndex}
              onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              onNext={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            />

            {/* Submit section */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
              <div className={`px-4 py-3 text-center border-b ${
                allAnswered
                  ? "bg-emerald-50 border-emerald-100"
                  : "bg-amber-50 border-amber-100"
              }`}>
                {allAnswered ? (
                  <>
                    <p className="text-emerald-700 text-sm font-bold flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      All questions answered
                    </p>
                    <p className="text-emerald-600 text-xs mt-0.5">Ready to submit your exam</p>
                  </>
                ) : (
                  <>
                    <p className="text-amber-700 text-sm font-bold">
                      {remaining} question{remaining !== 1 ? "s" : ""} remaining
                    </p>
                    <p className="text-amber-600 text-xs mt-0.5">Answer all to unlock submit</p>
                  </>
                )}
              </div>

              <div className="p-4">
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={submitting || !allAnswered}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-sm shadow-green-200 text-sm tracking-wide"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Submit Exam"
                  )}
                </button>

                {submitError && (
                  <p className="text-red-600 text-xs text-center bg-red-50 rounded-lg p-2 mt-3 border border-red-100">
                    {submitError}
                  </p>
                )}
              </div>
            </div>

            {/* Exam info card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Exam Info</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Total Questions</span>
                  <span className="font-semibold text-slate-700">{questions.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Marks per Question</span>
                  <span className="font-semibold text-slate-700">2</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Total Marks</span>
                  <span className="font-semibold text-slate-700">{questions.length * 2}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Duration</span>
                  <span className="font-semibold text-slate-700">{durationMinutes} min</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Submit Exam?</h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                You have answered all <strong className="text-slate-800">{questions.length}</strong> questions
                for a possible <strong className="text-slate-800">{questions.length * 2}</strong> marks.
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 border-2 border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => submitExam()}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all text-sm shadow-sm"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
