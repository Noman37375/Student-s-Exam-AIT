// Used for all teacher exams — topic is returned as a field in each question JSON
export function buildCustomMCQPrompt(configPrompt: string, count: number): string {
  return `You are an exam question writer. Follow these exam instructions exactly:

---
${configPrompt.trim()}
---

Your task: Generate exactly ${count} multiple-choice questions following ALL the instructions above (topic distribution, style, difficulty, etc.).

Rules:
1. Questions must be beginner to intermediate level.
2. No trick questions. No ambiguous phrasing.
3. Exactly ONE option must be unambiguously correct.
4. All 4 options must be plausible.
5. Do NOT include "A.", "B.", "C.", "D." prefixes in the option text.
6. Keep questions concise.
7. Each question must have a "topic" field — a short label for the subject area (e.g. "Python Fundamentals", "Basic OOP").

Output format: Return ONLY a valid JSON array. No markdown. No explanation. No extra text.
Each element must have exactly these keys:
{
  "topic": "...",
  "question": "...",
  "option_a": "...",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "correct_answer": "A" | "B" | "C" | "D"
}

Return ONLY the JSON array of exactly ${count} objects.`;
}
