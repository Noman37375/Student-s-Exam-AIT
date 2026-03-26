import { pgTable, uuid, text, integer, smallint, timestamp, char, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const students = pgTable("students", {
  studentId: text("student_id").primaryKey(),
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
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId:     uuid("session_id").notNull().references(() => examSessions.id, { onDelete: "cascade" }),
  topic:         text("topic").notNull(),
  question:      text("question").notNull(),
  optionA:       text("option_a").notNull(),
  optionB:       text("option_b").notNull(),
  optionC:       text("option_c").notNull(),
  optionD:       text("option_d").notNull(),
  correctAnswer: char("correct_answer", { length: 1 }).notNull(),
  studentAnswer: char("student_answer", { length: 1 }),
  orderIndex:    smallint("order_index").notNull(),
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
});
