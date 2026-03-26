import { pgTable, uuid, text, integer, smallint, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const students = pgTable("students", {
  studentId: text("student_id").primaryKey(),
  teacher:   text("teacher"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const examSessions = pgTable("exam_sessions", {
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentName:   text("student_name").notNull(),
  studentId:     text("student_id"),
  configId:      uuid("config_id"),
  startedAt:     timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt:   timestamp("submitted_at", { withTimezone: true }),
  score:         integer("score"),
  status:        text("status").notNull().default("in_progress"),
  totalMarks:    integer("total_marks").notNull().default(80),
  resultVisible: boolean("result_visible").notNull().default(false),
});

export const examQuestions = pgTable("exam_questions", {
  id:                uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId:         uuid("session_id").notNull().references(() => examSessions.id, { onDelete: "cascade" }),
  topic:             text("topic").notNull(),
  question:          text("question").notNull(),
  optionA:           text("option_a").notNull(),
  optionB:           text("option_b").notNull(),
  optionC:           text("option_c").notNull(),
  optionD:           text("option_d").notNull(),
  correctAnswer:     text("correct_answer").notNull(),
  studentAnswer:     text("student_answer"),
  orderIndex:        smallint("order_index").notNull(),
  questionType:      text("question_type").notNull().default("mcq"),
  marks:             smallint("marks").notNull().default(2),
  modelAnswer:       text("model_answer"),
  studentAnswerText: text("student_answer_text"),
  aiScore:           integer("ai_score"),
});

export const adminUsers = pgTable("admin_users", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username:  text("username").notNull().unique(),
  password:  text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const examConfigs = pgTable("exam_configs", {
  id:              uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title:           text("title").notNull(),
  description:     text("description").notNull(),
  generatedPrompt: text("generated_prompt").notNull(),
  createdBy:       text("created_by").notNull(),
  isActive:        boolean("is_active").notNull().default(false),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  questionConfig:  jsonb("question_config"),
  totalMarks:      integer("total_marks"),
});

export const questionBank = pgTable("question_bank", {
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  configId:      uuid("config_id").notNull().references(() => examConfigs.id, { onDelete: "cascade" }),
  type:          text("type").notNull(),
  topic:         text("topic").notNull(),
  question:      text("question").notNull(),
  optionA:       text("option_a"),
  optionB:       text("option_b"),
  optionC:       text("option_c"),
  optionD:       text("option_d"),
  correctAnswer: text("correct_answer").notNull().default(""),
  modelAnswer:   text("model_answer"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
