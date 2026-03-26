import Link from "next/link";

export default function SubmittedPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Success icon */}
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
              <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Exam Submitted!</h1>
          <p className="text-slate-500 mt-1.5 text-sm">Your responses have been recorded successfully.</p>
        </div>

        {/* Info cards */}
        <div className="space-y-3 mb-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Result Pending</p>
              <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Your result will be announced by your instructor once grading is complete.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Check Your Result</p>
              <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">Visit the <strong className="text-slate-700">Student Portal</strong> and enter your Student ID to view your result once announced.</p>
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 mb-5 text-center">
          <p className="text-white font-semibold text-sm">Your result will be announced soon</p>
          <p className="text-blue-200 text-xs mt-0.5">Check the student portal after your instructor announces results</p>
        </div>

        <div className="space-y-2">
          <Link href="/portal"
            className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-200 text-sm">
            Go to Student Portal
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link href="/"
            className="flex items-center justify-center w-full py-2.5 text-slate-400 hover:text-slate-600 text-sm font-medium">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
