import type { ExamResult } from "@/types/exam";

/* ─── Individual Marksheet (opens in new tab for print/save as PDF) ──────── */

export function openMarksheet(result: ExamResult, examTitle = "Exam") {
  const html = buildMarksheetHTML(result, examTitle);
  const win  = window.open("", "_blank", "width=860,height=700");
  if (!win) { alert("Please allow popups to download the marksheet."); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 600);
}

function bar(pct: number, color: string) {
  const filled = Math.round(pct / 5);
  return `<span style="color:${color}">${"█".repeat(filled)}</span><span style="color:#e2e8f0">${"█".repeat(20 - filled)}</span>`;
}

function buildMarksheetHTML(result: ExamResult, examTitle: string): string {
  const { studentName, studentId, score, totalMarks, percentage, passed, passScore, submittedAt, topicBreakdown } = result;
  const date   = submittedAt ? new Date(submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—";
  const topics = Object.entries(topicBreakdown ?? {});
  const passColor  = passed ? "#059669" : "#dc2626";
  const passBg     = passed ? "#d1fae5" : "#fee2e2";
  const passBorder = passed ? "#6ee7b7" : "#fca5a5";

  const topicRows = topics.map(([topic, stats]) => {
    const pct   = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const color = pct >= 70 ? "#059669" : pct >= 40 ? "#d97706" : "#dc2626";
    return `
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:8px 12px;font-weight:600;color:#334155">${topic}</td>
        <td style="padding:8px 12px;text-align:center;color:#64748b">${stats.correct}/${stats.total}</td>
        <td style="padding:8px 12px;text-align:center;font-weight:700;color:${color}">${pct}%</td>
        <td style="padding:8px 12px;font-family:monospace;font-size:12px;letter-spacing:-1px">${bar(pct, color)}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Marksheet — ${studentName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 32px; }
  .page { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.10); }
  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; border-radius: 0; max-width: 100%; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<!-- Print button -->
<div class="no-print" style="max-width:720px;margin:0 auto 16px;display:flex;gap:10px">
  <button onclick="window.print()" style="padding:10px 24px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer">
    🖨 Print / Save as PDF
  </button>
  <button onclick="window.close()" style="padding:10px 20px;background:#f1f5f9;color:#475569;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">
    ✕ Close
  </button>
</div>

<div class="page">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1d4ed8,#4f46e5);padding:32px 36px;color:#fff">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:3px;opacity:.75;text-transform:uppercase;margin-bottom:4px">Official Marksheet</div>
        <div style="font-size:22px;font-weight:800">${examTitle}</div>
      </div>
      <div style="text-align:right;opacity:.85;font-size:13px">
        <div>${date}</div>
        <div style="margin-top:2px;font-size:11px;opacity:.7">AI Exam System</div>
      </div>
    </div>
  </div>

  <!-- Student Info -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #e2e8f0">
    <div style="padding:20px 28px;border-right:1px solid #e2e8f0">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:4px">Student Name</div>
      <div style="font-size:17px;font-weight:700;color:#0f172a">${studentName}</div>
    </div>
    <div style="padding:20px 28px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:4px">Student ID</div>
      <div style="font-size:17px;font-weight:700;color:#1d4ed8;font-family:monospace">${studentId ?? "—"}</div>
    </div>
  </div>

  <!-- Score Block -->
  <div style="padding:36px 28px;text-align:center;background:#f8fafc;border-bottom:1px solid #e2e8f0">
    <div style="font-size:56px;font-weight:900;color:#0f172a;line-height:1">
      ${score}<span style="font-size:28px;font-weight:400;color:#94a3b8"> / ${totalMarks}</span>
    </div>
    <div style="font-size:28px;font-weight:800;margin:8px 0;color:${passColor}">${percentage}%</div>
    <div style="display:inline-block;padding:8px 28px;border-radius:999px;font-weight:800;font-size:15px;letter-spacing:1px;background:${passBg};color:${passColor};border:2px solid ${passBorder};margin-top:4px">
      ${passed ? "✓ PASSED" : "✗ FAILED"}
    </div>
    <div style="margin-top:12px;font-size:12px;color:#94a3b8">Pass mark: ${passScore} / ${totalMarks} (50%)</div>
  </div>

  <!-- Topic Breakdown -->
  ${topics.length > 0 ? `
  <div style="padding:24px 28px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;margin-bottom:12px">Topic Breakdown</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0">
          <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b">Topic</th>
          <th style="padding:8px 12px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b">Correct</th>
          <th style="padding:8px 12px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b">Score</th>
          <th style="padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b">Performance</th>
        </tr>
      </thead>
      <tbody>${topicRows}</tbody>
    </table>
  </div>` : ""}

  <!-- Footer -->
  <div style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#94a3b8">
    <span>Generated on ${new Date().toLocaleString()}</span>
    <span>AI Exam System · Confidential</span>
  </div>
</div>

</body>
</html>`;
}

/* ─── Class Report CSV (teacher downloads all students) ─────────────────── */

interface SessionRow {
  studentName: string;
  studentId:   string | null;
  score:       number | null;
  totalMarks:  number;
  submittedAt: string | null;
  resultVisible: boolean;
}

export function downloadClassReportCSV(sessions: SessionRow[], label = "class_report") {
  const headers = ["#", "Student Name", "Student ID", "Score", "Total Marks", "Percentage", "Result", "Submitted At"];

  const rows = sessions.map((s, i) => {
    const pct    = s.score != null ? Math.round((s.score / s.totalMarks) * 100) : null;
    const passed = s.score != null ? s.score >= Math.ceil(s.totalMarks * 0.5) : null;
    return [
      i + 1,
      s.studentName,
      s.studentId ?? "",
      s.score ?? "Pending",
      s.totalMarks,
      pct != null ? `${pct}%` : "—",
      passed != null ? (passed ? "PASS" : "FAIL") : "Pending",
      s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "—",
    ];
  });

  const csv  = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${label}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
