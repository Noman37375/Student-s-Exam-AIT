import OpenAI from "openai";
import { z } from "zod";
import { getPromptBuilder, type QuestionConfig, type QuestionTypeKey } from "./prompts";

// ─── API key rotation ────────────────────────────────────────────────────────

function getApiKeys(): string[] {
  const keys: string[] = [];
  if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

// ─── Generated question shape ────────────────────────────────────────────────

export interface GeneratedQuestion {
  type:           QuestionTypeKey;
  topic:          string;
  question:       string;
  marks:          number;
  // MCQ / TF
  option_a?:      string;
  option_b?:      string;
  option_c?:      string;
  option_d?:      string;
  correct_answer?: string;
  // Fill / Code
  model_answer?:  string;
}

// ─── Zod schemas per type ────────────────────────────────────────────────────

const BaseSchema = z.object({ type: z.string(), topic: z.string().min(1), question: z.string().min(5) });

const MCQSchema = BaseSchema.extend({
  option_a:       z.string().min(1),
  option_b:       z.string().min(1),
  option_c:       z.string().min(1),
  option_d:       z.string().min(1),
  correct_answer: z.enum(["A", "B", "C", "D"]),
});

const TFSchema = BaseSchema.extend({
  correct_answer: z.enum(["True", "False"]),
});

const FillSchema  = BaseSchema.extend({ model_answer: z.string().min(1) });
const CodeSchema  = BaseSchema.extend({ model_answer: z.string().min(1) });

function getSchema(type: QuestionTypeKey) {
  switch (type) {
    case "mcq":        return MCQSchema;
    case "true_false": return TFSchema;
    case "fill_blank": return FillSchema;
    case "code":       return CodeSchema;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function deduplicateQuestions(questions: GeneratedQuestion[]): GeneratedQuestion[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    const key = q.question.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── LLM call with key rotation ──────────────────────────────────────────────

async function callGroq(prompt: string, maxTokens = 4096, temperature = 0.7): Promise<string> {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error("No GROQ_API_KEY configured.");

  let lastError: unknown;
  for (const apiKey of keys) {
    try {
      const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
      const res = await client.chat.completions.create({
        model:       "llama-3.3-70b-versatile",
        messages:    [{ role: "user", content: prompt }],
        temperature,
        max_tokens:  maxTokens,
      });
      return res.choices[0]?.message?.content ?? "";
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 429 || status === 503) { lastError = err; continue; }
      throw err;
    }
  }
  throw lastError ?? new Error("All Groq API keys exhausted.");
}

// ─── Fetch a batch of one question type ──────────────────────────────────────

const BATCH_HINTS = [
  "Focus on DEFINITIONS and SYNTAX — cover foundational subtopics.",
  "Focus on CODE OUTPUT and APPLICATION — cover intermediate subtopics. Avoid repeating basic definitions.",
  "Focus on SCENARIOS and ADVANCED concepts — cover applied subtopics. Avoid questions already covered in simpler batches.",
] as const;

const BATCH_TEMPS = [0.6, 0.75, 0.9] as const;

async function fetchTypeBatch(
  type: QuestionTypeKey,
  teacherPrompt: string,
  count: number,
  batchIndex = 0,
): Promise<GeneratedQuestion[]> {
  const hint     = BATCH_HINTS[batchIndex % 3];
  const temp     = BATCH_TEMPS[batchIndex % 3];
  const builder  = getPromptBuilder(type);
  const schema   = getSchema(type);
  const prompt   = `${builder(teacherPrompt, count)}\n\nBATCH INSTRUCTION: ${hint}\n\nCRITICAL: Return ONLY a raw JSON array of exactly ${count} objects. No markdown.`;

  const parse = (r: string) => {
    const cleaned = r.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    const parsed  = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Not an array");
    return z.array(schema).parse(parsed) as GeneratedQuestion[];
  };

  let raw = await callGroq(prompt, 4096, temp);
  try {
    const qs = parse(raw);
    if (qs.length >= count - 1) return qs.slice(0, count);
    throw new Error(`Only got ${qs.length}`);
  } catch {
    raw = await callGroq(prompt, 4096, temp);
    return parse(raw).slice(0, count);
  }
}

// ─── Main entry ──────────────────────────────────────────────────────────────

export async function generateAllQuestions(
  teacherPrompt: string | null | undefined,
  questionConfig?: QuestionConfig | null,
): Promise<GeneratedQuestion[]> {
  if (!teacherPrompt) throw new Error("No exam configuration provided.");

  // Build per-type batch plan — 3 parallel batches per type where count > 14
  type BatchJob = { type: QuestionTypeKey; count: number; batchIdx: number; marks: number };
  const jobs: BatchJob[] = [];

  // Default: pure MCQ if no questionConfig provided
  const config: QuestionConfig = questionConfig && Object.keys(questionConfig).length > 0
    ? questionConfig
    : { mcq: { count: 40, marksEach: 2 } };

  const VALID_TYPES = new Set<string>(["mcq", "true_false", "fill_blank", "code"]);

  let batchIdx = 0;
  for (const [typeKey, cfg] of Object.entries(config) as [QuestionTypeKey, { count: number; marksEach: number }][]) {
    if (!VALID_TYPES.has(typeKey)) continue;  // skip legacy camelCase keys
    if (!cfg || cfg.count <= 0) continue;
    const { count, marksEach } = cfg;

    if (count <= 14) {
      jobs.push({ type: typeKey, count, batchIdx: batchIdx++, marks: marksEach });
    } else {
      // Split into batches of ~14
      const batches = Math.ceil(count / 14);
      const base    = Math.floor(count / batches);
      let remaining = count;
      for (let b = 0; b < batches; b++) {
        const bCount = b === batches - 1 ? remaining : base;
        jobs.push({ type: typeKey, count: bCount, batchIdx: batchIdx++, marks: marksEach });
        remaining -= bCount;
      }
    }
  }

  // Run all batches in parallel
  const results = await Promise.all(
    jobs.map(({ type, count, batchIdx: bi, marks }) =>
      fetchTypeBatch(type, teacherPrompt, count, bi).then((qs) =>
        qs.map((q) => ({ ...q, type, marks }))
      )
    )
  );

  let questions = deduplicateQuestions(results.flat());

  // Per-type top-up if deduplication caused shortfall
  const totalNeeded = Object.values(config).reduce((s, c) => s + (c?.count ?? 0), 0);
  if (questions.length < totalNeeded) {
    const missing = totalNeeded - questions.length;
    try {
      // Top-up with MCQ (or first available type)
      const topUpType = (Object.keys(config)[0] as QuestionTypeKey) ?? "mcq";
      const topUpMarks = config[topUpType]?.marksEach ?? 2;
      const extra = await fetchTypeBatch(topUpType, teacherPrompt, missing + 3);
      questions = deduplicateQuestions([
        ...questions,
        ...extra.map((q) => ({ ...q, type: topUpType, marks: topUpMarks })),
      ]);
    } catch { /* use what we have */ }
  }

  return shuffle(questions.slice(0, totalNeeded));
}
