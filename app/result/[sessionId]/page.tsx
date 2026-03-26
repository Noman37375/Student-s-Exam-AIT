import { notFound } from "next/navigation";
import Link from "next/link";
import ResultSummary from "@/components/ResultSummary";
import AnswerReview from "@/components/AnswerReview";
import PrintButton from "@/components/PrintButton";
import type { ExamResult } from "@/types/exam";

async function getResult(sessionId: string): Promise<ExamResult | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const res = await fetch(`${baseUrl}/api/exam/result/${sessionId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function ResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const result = await getResult(sessionId);
  if (!result) notFound();

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-200">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Exam Results</h1>
          <p className="text-slate-600 font-semibold mt-1">{result.studentName}</p>
          {result.studentId && (
            <p className="text-blue-600 font-mono text-xs font-bold mt-0.5">{result.studentId}</p>
          )}
          <p className="text-slate-400 text-xs mt-1">
            {result.submittedAt ? new Date(result.submittedAt).toLocaleString() : ""}
          </p>
        </div>

        <div className="space-y-4">
          <ResultSummary result={result} />
          <AnswerReview questions={result.questions} />

          <div className="flex flex-col sm:flex-row gap-3 justify-center pb-4">
            <Link href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-sm text-sm">
              Take New Exam
            </Link>
            <PrintButton />
          </div>
        </div>
      </div>
    </main>
  );
}
