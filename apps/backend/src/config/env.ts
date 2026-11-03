import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config(); // fallback to local

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().default('postgresql://app_user:app_password@localhost:5435/signet_support_lab'),
  API_SECRET_KEY: z.string().default('dev-secret-key-customer-support-2026'),
  OLLAMA_BASE_URL: z.string().default('https://ollama.com'),
  OLLAMA_MODEL: z.string().default('beam:cloud'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().default(120000),
  OLLAMA_API_KEY: z.string().optional(),
  TENANT_ID: z.string().default('tenant-support-lab-01')
});

export const env = EnvSchema.parse(process.env);
