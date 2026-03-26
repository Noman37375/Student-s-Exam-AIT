"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { ExamQuestion } from "@/types/exam";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const LANGUAGES = [
  { value: "plaintext",  label: "Plain Text"  },
  { value: "javascript", label: "JavaScript"  },
  { value: "typescript", label: "TypeScript"  },
  { value: "python",     label: "Python"      },
  { value: "html",       label: "HTML"        },
  { value: "css",        label: "CSS"         },
  { value: "java",       label: "Java"        },
  { value: "cpp",        label: "C++"         },
];

const SYMBOLS = [
  { label: "(  )", insert: "("  },
  { label: "{  }", insert: "{"  },
  { label: "[  ]", insert: "["  },
  { label: ":",    insert: ":"  },
  { label: ";",    insert: ";"  },
  { label: ",",    insert: ","  },
  { label: ".",    insert: "."  },
  { label: "=",    insert: "="  },
  { label: "==",   insert: "==" },
  { label: "!=",   insert: "!=" },
  { label: '""',   insert: '"'  },
  { label: "''",   insert: "'"  },
  { label: "->",   insert: "->" },
  { label: "=>",   insert: "=>" },
  { label: "+=",   insert: "+=" },
  { label: "↵",    insert: "\n" },
];

interface ExamCardProps {
  question:       ExamQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: string | null;
  onAnswer:       (answer: string) => void;
}

/* ─── Topic styling ─────────────────────────────────────────────────────── */
const topicStyles: Record<string, { badge: string; accent: string }> = {
  "Python Fundamentals":  { badge: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",       accent: "from-blue-500 to-indigo-600"    },
  "Basic OOP":            { badge: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",  accent: "from-violet-500 to-purple-600"  },
  "Basic Gen AI & Tools": { badge: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", accent: "from-emerald-500 to-teal-600" },
  "HTML":                 { badge: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",  accent: "from-orange-500 to-red-500"     },
  "CSS":                  { badge: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",           accent: "from-sky-500 to-blue-500"       },
  "JavaScript":           { badge: "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200",  accent: "from-yellow-400 to-amber-500"   },
};
const FALLBACKS = [
  { badge: "bg-pink-100 text-pink-700 ring-1 ring-pink-200",     accent: "from-pink-500 to-rose-500"    },
  { badge: "bg-teal-100 text-teal-700 ring-1 ring-teal-200",     accent: "from-teal-500 to-cyan-600"    },
  { badge: "bg-lime-100 text-lime-700 ring-1 ring-lime-200",     accent: "from-lime-500 to-green-500"   },
  { badge: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200", accent: "from-indigo-500 to-blue-600" },
];
function getTopicStyle(topic: string) {
  return topicStyles[topic] ?? FALLBACKS[topic.charCodeAt(0) % FALLBACKS.length];
}

/* ─── Question type label ────────────────────────────────────────────────── */
const TYPE_LABELS: Record<string, string> = {
  mcq:        "Multiple Choice",
  true_false: "True / False",
  fill_blank: "Fill in the Blank",
  code:       "Coding",
};
const TYPE_COLORS: Record<string, string> = {
  mcq:        "bg-blue-50 text-blue-600 ring-1 ring-blue-200",
  true_false: "bg-amber-50 text-amber-600 ring-1 ring-amber-200",
  fill_blank: "bg-purple-50 text-purple-600 ring-1 ring-purple-200",
  code:       "bg-slate-800 text-slate-100",
};

/* ─── MCQ options ────────────────────────────────────────────────────────── */
const MCQ_OPTIONS    = ["A", "B", "C", "D"] as const;
const OPT_SELECTED   = ["border-blue-500 bg-blue-50 shadow-blue-100 shadow-md", "border-violet-500 bg-violet-50 shadow-violet-100 shadow-md", "border-emerald-500 bg-emerald-50 shadow-emerald-100 shadow-md", "border-amber-500 bg-amber-50 shadow-amber-100 shadow-md"];
const OPT_BUBBLE     = ["bg-blue-500 text-white", "bg-violet-500 text-white", "bg-emerald-500 text-white", "bg-amber-500 text-white"];

function getOptionText(q: ExamQuestion, opt: "A" | "B" | "C" | "D") {
  return { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[opt];
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function ExamCard({ question, questionNumber, totalQuestions, selectedAnswer, onAnswer }: ExamCardProps) {
  const style      = getTopicStyle(question.topic);
  const qtype      = question.questionType ?? "mcq";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef  = useRef<any>(null);
  const [codeLang, setCodeLang] = useState("plaintext");

  function insertSymbol(text: string) {
    const ed = editorRef.current;
    if (!ed) return;
    ed.trigger("keyboard", "type", { text });
    ed.focus();
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
      <div className={`h-1.5 bg-gradient-to-r ${style.accent}`} />

      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="bg-slate-800 text-white text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide">Q{questionNumber}</span>
            <span className="text-xs text-slate-400 font-medium">of {totalQuestions}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_COLORS[qtype] ?? TYPE_COLORS.mcq}`}>
              {TYPE_LABELS[qtype] ?? qtype}
            </span>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${style.badge}`}>{question.topic}</span>
        </div>

        {/* Question text */}
        <div className="mb-7">
          <p className="text-base md:text-lg font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
            {question.question}
          </p>
        </div>

        {/* ── MCQ ── */}
        {qtype === "mcq" && (
          <div className="space-y-3">
            {MCQ_OPTIONS.map((opt, idx) => {
              const isSelected = selectedAnswer === opt;
              return (
                <button key={opt} onClick={() => onAnswer(opt)}
                  className={`w-full text-left rounded-xl border-2 transition-all duration-200 flex items-center gap-4 px-4 py-3.5 group ${isSelected ? OPT_SELECTED[idx] : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white hover:shadow-sm"}`}>
                  <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold flex-shrink-0 transition-all duration-200 ${isSelected ? OPT_BUBBLE[idx] : "bg-white border-2 border-slate-200 text-slate-500 group-hover:border-slate-300"}`}>
                    {opt}
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
        )}

        {/* ── True / False ── */}
        {qtype === "true_false" && (
          <div className="grid grid-cols-2 gap-4">
            {(["True", "False"] as const).map((val) => {
              const isSelected = selectedAnswer === val;
              return (
                <button key={val} onClick={() => onAnswer(val)}
                  className={`py-5 rounded-2xl border-2 font-bold text-lg transition-all duration-200 ${
                    isSelected
                      ? val === "True"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-100"
                        : "border-red-500 bg-red-50 text-red-700 shadow-md shadow-red-100"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white"
                  }`}>
                  {val === "True" ? "✓ True" : "✗ False"}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Fill in the Blank ── */}
        {qtype === "fill_blank" && (
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Your Answer</label>
            <input
              type="text"
              value={selectedAnswer ?? ""}
              onChange={(e) => onAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-500 focus:outline-none text-slate-800 font-medium text-base transition-colors"
            />
            <p className="text-xs text-slate-400 mt-2">Fill in the blank with the correct word or phrase.</p>
          </div>
        )}

        {/* ── Code ── */}
        {qtype === "code" && (
          <div>
            {/* Toolbar */}
            <div className="rounded-xl overflow-hidden border border-slate-700 shadow-lg">
              {/* Top bar: language selector + label */}
              <div className="bg-slate-800 px-3 py-2 flex items-center justify-between gap-2 border-b border-slate-700">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Code Editor</label>
                <select
                  value={codeLang}
                  onChange={(e) => setCodeLang(e.target.value)}
                  className="bg-slate-700 text-slate-200 text-xs font-mono px-2 py-1 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-400 cursor-pointer"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* Symbol quick-insert bar */}
              <div className="bg-slate-900 px-2 py-1.5 flex flex-wrap gap-1 border-b border-slate-700">
                {SYMBOLS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => insertSymbol(s.insert)}
                    className="px-2 py-0.5 text-xs font-mono bg-slate-700 hover:bg-slate-600 text-slate-200 rounded border border-slate-600 hover:border-slate-500 transition-colors select-none"
                    title={`Insert ${s.label}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Monaco editor */}
              <MonacoEditor
                height="300px"
                language={codeLang}
                theme="vs-dark"
                value={selectedAnswer ?? ""}
                onChange={(val) => onAnswer(val ?? "")}
                onMount={(editor) => { editorRef.current = editor; }}
                options={{
                  minimap:                    { enabled: false },
                  fontSize:                   14,
                  lineNumbers:                "on",
                  scrollBeyondLastLine:       false,
                  wordWrap:                   "on",
                  automaticLayout:            true,
                  padding:                    { top: 14, bottom: 14 },
                  tabSize:                    4,
                  insertSpaces:               true,
                  renderLineHighlight:        "all",
                  cursorBlinking:             "blink",
                  cursorSmoothCaretAnimation: "on",
                  smoothScrolling:            true,
                  formatOnType:               true,
                  formatOnPaste:              true,
                  autoClosingBrackets:        "always",
                  autoClosingQuotes:          "always",
                  autoIndent:                 "full",
                  folding:                    true,
                  foldingHighlight:           true,
                  showFoldingControls:        "always",
                  quickSuggestions:           { other: true, comments: false, strings: true },
                  suggestOnTriggerCharacters: true,
                  acceptSuggestionOnEnter:    "on",
                  snippetSuggestions:         "top",
                  suggest:                    { showKeywords: true, showSnippets: true },
                  bracketPairColorization:    { enabled: true },
                  guides:                     { bracketPairs: true, indentation: true },
                  renderWhitespace:           "selection",
                  scrollbar:                  { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">Select your language, then write your code. Click symbols above to insert at cursor.</p>
          </div>
        )}

        {/* Marks badge */}
        <div className="mt-5 flex justify-end">
          <span className="text-xs text-slate-400 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
            {question.marks ?? 2} mark{(question.marks ?? 2) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
