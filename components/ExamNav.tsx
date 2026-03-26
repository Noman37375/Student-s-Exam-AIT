"use client";

import type { AnswerOption } from "@/types/exam";

interface ExamNavProps {
  currentIndex: number;
  totalQuestions: number;
  answers: Record<string, AnswerOption>;
  questionIds: string[];
  onNavigate: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function ExamNav({
  currentIndex,
  totalQuestions,
  answers,
  questionIds,
  onNavigate,
  onPrev,
  onNext,
}: ExamNavProps) {
  const answeredCount = Object.keys(answers).length;
  const pct = Math.round((answeredCount / totalQuestions) * 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
      {/* Progress bar top */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="p-4 space-y-4">
        {/* Progress summary */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Progress</p>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-slate-800">{answeredCount}</span>
            <span className="text-xs text-slate-400">/ {totalQuestions}</span>
            <span className="text-xs text-slate-400 ml-1">({pct}%)</span>
          </div>
        </div>

        {/* Question grid */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">Question Map</p>
          <div className="grid grid-cols-8 gap-1.5">
            {questionIds.map((id, i) => {
              const answered = !!answers[id];
              const isCurrent = i === currentIndex;
              return (
                <button
                  key={id}
                  onClick={() => onNavigate(i)}
                  title={`Question ${i + 1}${answered ? " (answered)" : ""}`}
                  className={`w-full aspect-square rounded-lg text-xs font-bold transition-all duration-150 relative ${
                    isCurrent
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200 scale-110 z-10"
                      : answered
                      ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-105"
                      : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 hover:scale-105"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-3 mt-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
              Current
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
              Answered
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3 h-3 rounded bg-slate-200 inline-block" />
              Pending
            </span>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ← Prev
          </button>
          <button
            onClick={onNext}
            disabled={currentIndex === totalQuestions - 1}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm shadow-blue-200"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
