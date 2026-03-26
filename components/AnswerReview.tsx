"use client";

import { useState } from "react";
import type { ExamResultQuestion } from "@/types/exam";

interface AnswerReviewProps {
  questions: ExamResultQuestion[];
}

const FILTERS = ["all", "correct", "incorrect", "skipped"] as const;
type Filter = typeof FILTERS[number];

function isSkipped(q: ExamResultQuestion) {
  return q.studentAnswer === null && !q.studentAnswerText;
}

export default function AnswerReview({ questions }: AnswerReviewProps) {
  const [filter,     setFilter]     = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const counts = {
    all:       questions.length,
    correct:   questions.filter((q) => q.isCorrect).length,
    incorrect: questions.filter((q) => !q.isCorrect && !isSkipped(q)).length,
    skipped:   questions.filter(isSkipped).length,
  };

  const filtered = questions.filter((q) => {
    if (filter === "correct")   return q.isCorrect;
    if (filter === "incorrect") return !q.isCorrect && !isSkipped(q);
    if (filter === "skipped")   return isSkipped(q);
    return true;
  });

  const filterConfig = {
    all:       { active: "bg-slate-800 text-white",     inactive: "bg-slate-100 text-slate-500 hover:bg-slate-200"      },
    correct:   { active: "bg-emerald-500 text-white",   inactive: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" },
    incorrect: { active: "bg-red-500 text-white",       inactive: "bg-red-50 text-red-600 hover:bg-red-100"             },
    skipped:   { active: "bg-amber-400 text-white",     inactive: "bg-amber-50 text-amber-600 hover:bg-amber-100"       },
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-bold text-slate-900">Answer Review</h3>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${filter === f ? filterConfig[f].active : filterConfig[f].inactive}`}>
              {f} <span className="opacity-70">({counts[f]})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No questions in this category.</div>
        ) : filtered.map((q) => {
          const isExpanded = expandedId === q.id;
          const skipped    = isSkipped(q);
          const qtype      = q.questionType ?? "mcq";

          return (
            <div key={q.id}>
              <button onClick={() => setExpandedId(isExpanded ? null : q.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors">
                <span className={`w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 text-xs font-bold ${
                  q.isCorrect ? "bg-emerald-100 text-emerald-600" :
                  skipped     ? "bg-slate-100 text-slate-400"     :
                                "bg-red-100 text-red-500"
                }`}>
                  {q.isCorrect ? "✓" : skipped ? "–" : "✗"}
                </span>
                <span className="text-xs font-semibold text-slate-400 flex-shrink-0 w-7">Q{q.orderIndex + 1}</span>
                <span className="text-sm text-slate-700 flex-1 line-clamp-1">{q.question}</span>
                <span className="text-xs font-bold text-slate-500 flex-shrink-0">
                  {q.earnedMarks}/{q.marks}m
                </span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full hidden sm:inline flex-shrink-0 max-w-[100px] truncate">{q.topic}</span>
                <svg className={`w-4 h-4 text-slate-300 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 pt-1 bg-slate-50/80 border-t border-slate-100">
                  <p className="text-sm text-slate-800 font-medium py-3 leading-relaxed">{q.question}</p>

                  {/* MCQ */}
                  {qtype === "mcq" && (
                    <div className="space-y-2">
                      {(["A", "B", "C", "D"] as const).map((opt) => {
                        const text         = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[opt];
                        const isCorrectOpt = opt === q.correctAnswer;
                        const isStudentOpt = opt === q.studentAnswer;
                        const isWrong      = isStudentOpt && !isCorrectOpt;
                        return (
                          <div key={opt} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm border ${isCorrectOpt ? "bg-emerald-50 border-emerald-200 text-emerald-800" : isWrong ? "bg-red-50 border-red-200 text-red-800" : "bg-white border-slate-200 text-slate-600"}`}>
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isCorrectOpt ? "bg-emerald-200 text-emerald-700" : isWrong ? "bg-red-200 text-red-700" : "bg-slate-100 text-slate-500"}`}>{opt}</span>
                            <span className="flex-1">{text}</span>
                            {isCorrectOpt && <span className="text-xs font-semibold text-emerald-600 flex-shrink-0">✓ Correct</span>}
                            {isWrong      && <span className="text-xs font-semibold text-red-500 flex-shrink-0">Your answer</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* True/False */}
                  {qtype === "true_false" && (
                    <div className="grid grid-cols-2 gap-3">
                      {(["True", "False"] as const).map((val) => {
                        const isCorrectOpt = val === q.correctAnswer;
                        const isStudentOpt = val === q.studentAnswer;
                        const isWrong      = isStudentOpt && !isCorrectOpt;
                        return (
                          <div key={val} className={`px-4 py-3 rounded-xl text-sm font-semibold text-center border ${isCorrectOpt ? "bg-emerald-50 border-emerald-200 text-emerald-700" : isWrong ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-slate-200 text-slate-500"}`}>
                            {val}
                            {isCorrectOpt && <span className="block text-xs mt-0.5">✓ Correct</span>}
                            {isWrong      && <span className="block text-xs mt-0.5">Your answer</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Fill in the blank */}
                  {qtype === "fill_blank" && (
                    <div className="space-y-2">
                      <div className="px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50">
                        <p className="text-xs font-bold text-emerald-600 mb-1">Expected Answer</p>
                        <p className="text-sm font-semibold text-emerald-800">{q.modelAnswer ?? "—"}</p>
                      </div>
                      <div className={`px-4 py-3 rounded-xl border ${q.isCorrect ? "border-emerald-200 bg-emerald-50" : skipped ? "border-slate-200 bg-slate-50" : "border-red-200 bg-red-50"}`}>
                        <p className={`text-xs font-bold mb-1 ${q.isCorrect ? "text-emerald-600" : skipped ? "text-slate-400" : "text-red-500"}`}>Your Answer</p>
                        <p className={`text-sm font-semibold ${q.isCorrect ? "text-emerald-800" : skipped ? "text-slate-400" : "text-red-800"}`}>
                          {q.studentAnswerText ?? "—"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Code */}
                  {qtype === "code" && (
                    <div className="space-y-2">
                      <div className="rounded-xl overflow-hidden border border-slate-200">
                        <div className="bg-slate-700 px-3 py-1.5 text-xs text-slate-300 font-mono flex items-center justify-between">
                          <span>Your Code</span>
                          {q.aiScore !== null && <span className={`font-bold ${q.aiScore >= q.marks ? "text-emerald-400" : "text-amber-400"}`}>{q.aiScore}/{q.marks} marks</span>}
                        </div>
                        <pre className="bg-slate-800 text-slate-100 text-sm p-4 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                          {q.studentAnswerText || "No code submitted"}
                        </pre>
                      </div>
                      {q.modelAnswer && (
                        <div className="rounded-xl overflow-hidden border border-emerald-200">
                          <div className="bg-emerald-700 px-3 py-1.5 text-xs text-emerald-100 font-mono">Model Solution</div>
                          <pre className="bg-emerald-900/20 text-emerald-900 text-sm p-4 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                            {q.modelAnswer}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
