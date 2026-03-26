import OpenAI from "openai";
import { z } from "zod";

function getFirstApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("No GROQ_API_KEY configured.");
  return key;
}

const ScoreSchema = z.object({
  score:    z.number().min(0),
  feedback: z.string(),
});

async function callGroq(prompt: string): Promise<string> {
  const client = new OpenAI({ apiKey: getFirstApiKey(), baseURL: "https://api.groq.com/openai/v1" });
  const res = await client.chat.completions.create({
    model:       "llama-3.3-70b-versatile",
    messages:    [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens:  200,
  });
  return res.choices[0]?.message?.content ?? "";
}

export async function gradeFillBlank(
  question:     string,
  modelAnswer:  string,
  studentAnswer: string,
  maxMarks:     number,
): Promise<{ score: number; feedback: string }> {
  // Fast path: case-insensitive exact match
  if (studentAnswer.trim().toLowerCase() === modelAnswer.trim().toLowerCase()) {
    return { score: maxMarks, feedback: "Correct." };
  }

  // AI path for close answers
  const prompt = `You are grading a fill-in-the-blank exam question.

Question: ${question}
Expected answer: ${modelAnswer}
Student's answer: ${studentAnswer}
Maximum marks: ${maxMarks}

Award full marks (${maxMarks}) if the student's answer is correct or means the same thing.
Award 0 if wrong.

Respond ONLY with JSON: { "score": number, "feedback": "one sentence" }`;

  try {
    const raw     = await callGroq(prompt);
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    const parsed  = ScoreSchema.parse(JSON.parse(cleaned));
    return { score: Math.min(parsed.score, maxMarks), feedback: parsed.feedback };
  } catch {
    return { score: 0, feedback: "Could not grade automatically." };
  }
}

export async function gradeCode(
  question:      string,
  modelAnswer:   string,
  studentCode:   string,
  maxMarks:      number,
): Promise<{ score: number; feedback: string }> {
  if (!studentCode.trim()) return { score: 0, feedback: "No code submitted." };

  const prompt = `You are grading a coding exam question.

Question: ${question}
Expected solution: ${modelAnswer}
Student's code:
\`\`\`python
${studentCode}
\`\`\`
Maximum marks: ${maxMarks}

Evaluate the student's code for correctness and logic.
- Full marks: correct and works as expected.
- Partial marks: partially correct logic or minor errors.
- Zero: completely wrong or missing.

Respond ONLY with JSON: { "score": number (0 to ${maxMarks}), "feedback": "one or two sentences" }`;

  try {
    const raw     = await callGroq(prompt);
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    const parsed  = ScoreSchema.parse(JSON.parse(cleaned));
    return { score: Math.min(Math.round(parsed.score), maxMarks), feedback: parsed.feedback };
  } catch {
    return { score: 0, feedback: "Could not grade automatically." };
  }
}
