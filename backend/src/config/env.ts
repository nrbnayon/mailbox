// backend\src\config\env.ts
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().transform(Number),
  MONGODB_URI: z.string(),
  FRONTEND_URL: z.string().url(),
  FRONTEND_LIVE_URL: z.string().url(),
  JWT_SECRET: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string().url(),
  MICROSOFT_CLIENT_ID: z.string(),
  MICROSOFT_CLIENT_SECRET: z.string(),
  MICROSOFT_REDIRECT_URI: z.string().url(),
  YAHOO_CLIENT_ID: z.string(),
  YAHOO_CLIENT_SECRET: z.string(),
  YAHOO_REDIRECT_URI: z.string().url(),
  GROQ_API_KEY: z.string(),
  DEEPSEEK_API_KEY: z.string(),
  NODE_ENV: z.enum(["development", "production"]).optional(),
});

const env = envSchema.parse(process.env);

export default env;
