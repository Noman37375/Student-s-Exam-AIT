import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { examSessions, examQuestions } from "@/drizzle/schema";
import { gradeExam } from "@/lib/grader";
import { gradeFillBlank, gradeCode } from "@/lib/ai-grader";

const SubmitSchema = z.object({
  sessionId: z.string().uuid(),
  answers:   z.record(z.string().uuid(), z.string()),
});

export async function POST(req: NextRequest) {
  try {
    const { sessionId, answers } = SubmitSchema.parse(await req.json());

    const session = await db.query.examSessions.findFirst({
      where: (s, { eq }) => eq(s.id, sessionId),
    });
    if (!session)                         return NextResponse.json({ error: "Session not found." }, { status: 404 });
    if (session.status !== "in_progress") return NextResponse.json({ error: "Exam already submitted." }, { status: 409 });

    const questions = await db.query.examQuestions.findMany({
      where: (q, { eq }) => eq(q.sessionId, sessionId),
    });

    // AI-grade fill_blank and code questions in parallel
    const aiGradingJobs = questions
      .filter((q) => (q.questionType === "fill_blank" || q.questionType === "code") && answers[q.id])
      .map(async (q) => {
        const studentText = answers[q.id] ?? "";
        const modelAns    = q.modelAnswer ?? "";
        const result = q.questionType === "code"
          ? await gradeCode(q.question, modelAns, studentText, q.marks)
          : await gradeFillBlank(q.question, modelAns, studentText, q.marks);
        return { id: q.id, score: result.score };
      });

    const aiScores = Object.fromEntries(
      (await Promise.all(aiGradingJobs)).map(({ id, score }) => [id, score])
    );

    // Persist answers + AI scores
    await Promise.all(
      questions.map((q) => {
        const qtype = q.questionType ?? "mcq";
        const ans   = answers[q.id];
        if (!ans) return Promise.resolve();

        if (qtype === "mcq" || qtype === "true_false") {
          return db.update(examQuestions)
            .set({ studentAnswer: qtype === "mcq" ? ans.charAt(0) : ans })
            .where(eq(examQuestions.id, q.id));
        } else {
          return db.update(examQuestions)
            .set({ studentAnswerText: ans, aiScore: aiScores[q.id] ?? 0 })
            .where(eq(examQuestions.id, q.id));
        }
      })
    );

    // Reload questions with updated AI scores for grading
    const updatedQuestions = await db.query.examQuestions.findMany({
      where: (q, { eq }) => eq(q.sessionId, sessionId),
    });

    const gradingInput = updatedQuestions.map((q) => ({
      id:                q.id,
      topic:             q.topic,
      questionType:      q.questionType ?? "mcq",
      correctAnswer:     q.correctAnswer ?? "",
      studentAnswer:     q.studentAnswer ?? null,
      studentAnswerText: q.studentAnswerText ?? null,
      marks:             q.marks ?? 2,
      aiScore:           q.aiScore ?? null,
    }));

    const result = gradeExam(gradingInput, session.totalMarks);

    await db
      .update(examSessions)
      .set({ score: result.score, status: "submitted", submittedAt: new Date() })
      .where(eq(examSessions.id, sessionId));

    return NextResponse.json({ score: result.score, totalMarks: result.totalMarks });
  } catch (err) {
    console.error("[/api/exam/submit]", err);
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: "Failed to submit exam." }, { status: 500 });
  }
}
