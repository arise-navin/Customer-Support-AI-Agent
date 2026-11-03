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
  API_SECRET_KEY: z.string().default('dev-secret-key-signet-support-lab-2026'),
  OLLAMA_BASE_URL: z.string().default('https://ollama.com'),
  OLLAMA_MODEL: z.string().default('beam:cloud'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().default(120000),
  OLLAMA_API_KEY: z.string().optional(),
  AI_EXECUTION_MODE: z.enum(['DIRECT_OLLAMA', 'SIGNET_MOCK', 'SIGNET_REAL', 'SIGNET_HYBRID_EDGE']).default('DIRECT_OLLAMA'),
  SIGNET_GATEWAY_URL: z.string().default('http://localhost:8080'),
  SIGNET_TENANT_ID: z.string().default('tenant-support-lab-01'),
  SIGNET_ENFORCEMENT_REQUIRED: z.coerce.boolean().default(true),
  SIGNET_HYBRID_EDGE_ENABLED: z.coerce.boolean().default(true),
  SIGNET_HYBRID_SAAS_URL: z.string().default('https://cloud.signet.techsnitch.com'),
  SIGNET_HYBRID_HEARTBEAT_SEC: z.coerce.number().default(15)
});

export const env = EnvSchema.parse(process.env);
