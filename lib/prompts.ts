export type QuestionTypeKey = "mcq" | "true_false" | "fill_blank" | "code";

export interface QuestionTypeConfig {
  count:      number;
  marksEach:  number;
}

export type QuestionConfig = Partial<Record<QuestionTypeKey, QuestionTypeConfig>>;

// ─── Per-type prompt builders ────────────────────────────────────────────────

export function buildMCQBatchPrompt(teacherPrompt: string, count: number): string {
  return `You are an exam question writer. Follow these exam instructions:
---
${teacherPrompt.trim()}
---

Generate exactly ${count} MULTIPLE-CHOICE questions.
Rules:
- Exactly ONE correct option out of four.
- No "A.", "B.", "C.", "D." prefixes in option text.
- Include a "topic" field: short subject label.

Return ONLY a JSON array of exactly ${count} objects with these keys:
{ "type": "mcq", "topic": "...", "question": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_answer": "A"|"B"|"C"|"D" }`;
}

export function buildTrueFalseBatchPrompt(teacherPrompt: string, count: number): string {
  return `You are an exam question writer. Follow these exam instructions:
---
${teacherPrompt.trim()}
---

Generate exactly ${count} TRUE/FALSE questions.
Rules:
- Each question is a statement — student decides if it is True or False.
- No ambiguous statements. Unambiguously true or false.
- Include a "topic" field: short subject label.

Return ONLY a JSON array of exactly ${count} objects with these keys:
{ "type": "true_false", "topic": "...", "question": "...", "correct_answer": "True"|"False" }`;
}

export function buildFillBlankBatchPrompt(teacherPrompt: string, count: number): string {
  return `You are an exam question writer. Follow these exam instructions:
---
${teacherPrompt.trim()}
---

Generate exactly ${count} FILL-IN-THE-BLANK questions.
Rules:
- Use ___ (three underscores) to mark the blank in the question.
- model_answer must be the exact word or short phrase that fills the blank.
- Keep blanks focused on a single key concept.
- Include a "topic" field: short subject label.

Return ONLY a JSON array of exactly ${count} objects with these keys:
{ "type": "fill_blank", "topic": "...", "question": "...", "model_answer": "..." }`;
}

export function buildCodeBatchPrompt(teacherPrompt: string, count: number): string {
  return `You are an exam question writer. Follow these exam instructions:
---
${teacherPrompt.trim()}
---

Generate exactly ${count} CODING questions.
Rules:
- Each question asks the student to write code that solves a specific problem.
- model_answer must be a clean, correct, minimal code solution.
- Questions should be practical and appropriately challenging for beginners.
- Include a "topic" field: short subject label.

Return ONLY a JSON array of exactly ${count} objects with these keys:
{ "type": "code", "topic": "...", "question": "...", "model_answer": "..." }`;
}

export function getPromptBuilder(type: QuestionTypeKey) {
  switch (type) {
    case "mcq":        return buildMCQBatchPrompt;
    case "true_false": return buildTrueFalseBatchPrompt;
    case "fill_blank": return buildFillBlankBatchPrompt;
    case "code":       return buildCodeBatchPrompt;
  }
}
