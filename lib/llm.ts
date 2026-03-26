import OpenAI from "openai";
import { z } from "zod";
import { buildCustomMCQPrompt } from "./prompts";

// Collect all configured Groq API keys: GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, ...
function getApiKeys(): string[] {
  const keys: string[] = [];
  if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

const RawQuestionSchema = z.object({
  question:       z.string().min(5),
  option_a:       z.string().min(1),
  option_b:       z.string().min(1),
  option_c:       z.string().min(1),
  option_d:       z.string().min(1),
  correct_answer: z.enum(["A", "B", "C", "D"]),
});

const RawQuestionWithTopicSchema = RawQuestionSchema.extend({
  topic: z.string().min(1),
});

export type RawQuestion = z.infer<typeof RawQuestionSchema>;
export type RawQuestionWithTopic = z.infer<typeof RawQuestionWithTopicSchema>;

// Variety hints ensure each parallel batch targets different question styles/depths
const BATCH_HINTS = [
  "Focus on DEFINITIONS and SYNTAX questions — cover the most foundational subtopics of each area.",
  "Focus on FILL-IN-THE-BLANK and CODE OUTPUT PREDICTION questions — cover intermediate subtopics. Do not repeat basic definitions.",
  "Focus on SCENARIO-BASED and APPLICATION questions — cover advanced or applied subtopics. Avoid questions that test only simple recall.",
] as const;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function deduplicateQuestions(questions: RawQuestionWithTopic[]): RawQuestionWithTopic[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    // Normalize: lowercase, collapse whitespace, strip punctuation
    const key = q.question.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function callGroq(prompt: string, maxTokens = 4096): Promise<string> {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error("No GROQ_API_KEY configured.");

  let lastError: unknown;
  for (const apiKey of keys) {
    try {
      const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
      const response = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: maxTokens,
      });
      return response.choices[0]?.message?.content ?? "";
    } catch (err) {
      const status = (err as { status?: number })?.status;
      // Fallback on rate-limit or server overload; rethrow anything else
      if (status === 429 || status === 503) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("All Groq API keys exhausted.");
}

async function fetchBatch(configPrompt: string, n: number, batchHint?: string): Promise<RawQuestionWithTopic[]> {
  const hint = batchHint ? `\n\nBATCH INSTRUCTION: ${batchHint}` : "";
  const prompt = `${buildCustomMCQPrompt(configPrompt, n)}${hint}\n\nCRITICAL: Return ONLY a raw JSON array of exactly ${n} objects. No markdown, no extra text.`;

  const parse = (r: string) => {
    const cleaned = r.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    const parsed  = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Not an array");
    return z.array(RawQuestionWithTopicSchema).parse(parsed);
  };

  let raw = await callGroq(prompt, 4096);
  try {
    const qs = parse(raw);
    if (qs.length >= n - 1) return qs.slice(0, n);
    throw new Error(`Only got ${qs.length}`);
  } catch {
    // Retry once
    raw = await callGroq(prompt, 4096);
    return parse(raw).slice(0, n);
  }
}

// 3 parallel calls: 14 + 13 + 13 = 40
export async function generateAllQuestions(
  configPrompt?: string | null,
): Promise<RawQuestionWithTopic[]> {
  if (!configPrompt) {
    throw new Error("No exam configuration provided. Please select a teacher.");
  }

  const [batch1, batch2, batch3] = await Promise.all([
    fetchBatch(configPrompt, 14, BATCH_HINTS[0]),
    fetchBatch(configPrompt, 13, BATCH_HINTS[1]),
    fetchBatch(configPrompt, 13, BATCH_HINTS[2]),
  ]);

  let questions = deduplicateQuestions([...batch1, ...batch2, ...batch3]);

  // Top-up loop — retry up to 3 times, ask for a few extra to absorb deduplication losses
  for (let attempt = 0; attempt < 3 && questions.length < 40; attempt++) {
    const missing = 40 - questions.length;
    try {
      const extra = await fetchBatch(configPrompt, missing + 3); // +3 buffer for dedup losses
      questions   = deduplicateQuestions([...questions, ...extra]);
    } catch { break; }
  }

  return shuffle(questions.slice(0, 40));
}
