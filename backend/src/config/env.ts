import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().optional(),
  NEON_DATABASE_URL: z.string().optional(),
  LLM_API_BASE_URL: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(["groq"]).default("groq"),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
  GROQ_CHAT_MODEL: z.string().min(1, "GROQ_CHAT_MODEL is required"),
  GROQ_CODE_MODEL: z.string().min(1, "GROQ_CODE_MODEL is required"),
  GROQ_REASONING_MODEL: z.string().min(1, "GROQ_REASONING_MODEL is required"),
  WS_CORS_ORIGIN: z.string().default("*"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid backend environment variables", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
