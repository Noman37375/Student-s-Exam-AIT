import type { ExamResult } from "@/types/exam";

export default function ResultSummary({ result }: { result: ExamResult }) {
  const { score, totalMarks, percentage, passed } = result;

  return (
    <div className={`rounded-2xl p-8 text-center border-2 ${
      passed
        ? "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200"
        : "bg-gradient-to-br from-red-50 to-rose-50 border-red-200"
    }`}>
      {/* Score */}
      <div className={`text-6xl font-black mb-1 tracking-tight ${passed ? "text-emerald-600" : "text-red-500"}`}>
        {score}
        <span className="text-3xl font-medium text-slate-400">/{totalMarks}</span>
      </div>

      {/* Percentage */}
      <div className={`text-2xl font-bold mb-4 ${passed ? "text-emerald-700" : "text-red-600"}`}>
        {percentage}%
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-white/60 rounded-full mb-5 overflow-hidden max-w-xs mx-auto">
        <div
          className={`h-full rounded-full transition-all duration-700 ${passed ? "bg-emerald-500" : "bg-red-400"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Badge */}
      <span className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold ${
        passed ? "bg-emerald-200 text-emerald-800" : "bg-red-200 text-red-800"
      }`}>
        {passed ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            PASSED
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            FAILED
          </>
        )}
      </span>

      <p className="text-slate-500 text-xs mt-3">Pass mark: {result.passScore} / {totalMarks}</p>
    </div>
  );
}
