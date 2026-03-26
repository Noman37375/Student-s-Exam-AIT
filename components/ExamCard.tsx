"use client";

import type { ExamQuestion, AnswerOption } from "@/types/exam";

interface ExamCardProps {
  question: ExamQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: AnswerOption | null;
  onAnswer: (answer: AnswerOption) => void;
}

const OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];

function getOptionText(question: ExamQuestion, option: AnswerOption): string {
  const map: Record<AnswerOption, string> = {
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  };
  return map[option];
}

const topicStyles: Record<string, { badge: string; accent: string }> = {
  "Python Fundamentals":  { badge: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",      accent: "from-blue-500 to-indigo-600"   },
  "Basic OOP":            { badge: "bg-violet-100 text-violet-700 ring-1 ring-violet-200", accent: "from-violet-500 to-purple-600" },
  "Basic Gen AI & Tools": { badge: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", accent: "from-emerald-500 to-teal-600" },
  "HTML":                 { badge: "bg-orange-100 text-orange-700 ring-1 ring-orange-200", accent: "from-orange-500 to-red-500"    },
  "CSS":                  { badge: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",          accent: "from-sky-500 to-blue-500"      },
  "JavaScript":           { badge: "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200", accent: "from-yellow-400 to-amber-500"  },
};

function getTopicStyle(topic: string) {
  if (topicStyles[topic]) return topicStyles[topic];
  // Generic fallback for unknown topics — cycle through a palette
  const fallbacks = [
    { badge: "bg-pink-100 text-pink-700 ring-1 ring-pink-200",   accent: "from-pink-500 to-rose-500"   },
    { badge: "bg-teal-100 text-teal-700 ring-1 ring-teal-200",   accent: "from-teal-500 to-cyan-600"   },
    { badge: "bg-lime-100 text-lime-700 ring-1 ring-lime-200",   accent: "from-lime-500 to-green-500"  },
    { badge: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200", accent: "from-indigo-500 to-blue-600" },
  ];
  const idx = topic.charCodeAt(0) % fallbacks.length;
  return fallbacks[idx];
}

const optionLabels = ["A", "B", "C", "D"];
const optionSelectedColors = [
  "border-blue-500 bg-blue-50 shadow-blue-100 shadow-md",
  "border-violet-500 bg-violet-50 shadow-violet-100 shadow-md",
  "border-emerald-500 bg-emerald-50 shadow-emerald-100 shadow-md",
  "border-amber-500 bg-amber-50 shadow-amber-100 shadow-md",
];
const optionBubbleColors = [
  "bg-blue-500 text-white",
  "bg-violet-500 text-white",
  "bg-emerald-500 text-white",
  "bg-amber-500 text-white",
];

export default function ExamCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onAnswer,
}: ExamCardProps) {
  const style = getTopicStyle(question.topic);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
      {/* Accent bar */}
      <div className={`h-1.5 bg-gradient-to-r ${style.accent}`} />

      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-slate-800 text-white text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide">
              Q{questionNumber}
            </span>
            <span className="text-xs text-slate-400 font-medium">of {totalQuestions}</span>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${style.badge}`}>
            {question.topic}
          </span>
        </div>

        {/* Question */}
        <div className="mb-7">
          <p className="text-base md:text-lg font-semibold text-slate-800 leading-relaxed">
            {question.question}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {OPTIONS.map((opt, idx) => {
            const isSelected = selectedAnswer === opt;
            return (
              <button
                key={opt}
                onClick={() => onAnswer(opt)}
                className={`w-full text-left rounded-xl border-2 transition-all duration-200 flex items-center gap-4 px-4 py-3.5 group ${
                  isSelected
                    ? optionSelectedColors[idx]
                    : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                }`}
              >
                <span
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold flex-shrink-0 transition-all duration-200 ${
                    isSelected
                      ? optionBubbleColors[idx]
                      : "bg-white border-2 border-slate-200 text-slate-500 group-hover:border-slate-300"
                  }`}
                >
                  {optionLabels[idx]}
                </span>
                <span className={`text-sm md:text-base leading-snug transition-colors ${isSelected ? "text-slate-900 font-medium" : "text-slate-700"}`}>
                  {getOptionText(question, opt)}
                </span>
                {isSelected && (
                  <span className="ml-auto flex-shrink-0">
                    <svg className="w-5 h-5 text-current opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mark info */}
        <div className="mt-5 flex justify-end">
          <span className="text-xs text-slate-400 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
            2 marks
          </span>
        </div>
      </div>
    </div>
  );
}
