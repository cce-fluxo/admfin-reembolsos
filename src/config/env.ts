import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  PIPEFY_TOKEN: z.string(),
  PIPEFY_WEBHOOK_SECRET: z.string(),
  PIPEFY_CENTRO_CUSTO_FIELD_ID: z.string(),
  CONTAAZUL_CLIENT_ID: z.string(),
  CONTAAZUL_CLIENT_SECRET: z.string(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  CONTAAZUL_CONCURRENCY: z.coerce.number().default(4),
  CONTAAZUL_CATEGORIA_IDS: z.string().optional(),
  SHEETS_APPS_SCRIPT_URL: z.string().url(),
  SHEETS_FASE_MONITORADA: z.string(),
  SHEETS_FASE_SEGUINTE: z.string(),
  FIELD_COMPETENCIA_ID: z.string(),
  FIELD_VENCIMENTO_ID: z.string(),
  FIELD_PAGAMENTO_ID: z.string(),
  FIELD_VALOR_ID: z.string(),
  FIELD_CATEGORIA_ID: z.string(),
  FIELD_DESCRICAO_ID: z.string(),
  FIELD_CLIENTE_FORNECEDOR_ID: z.string(),
  FIELD_CNPJ_CPF_ID: z.string(),
  FIELD_CENTRO_CUSTO_ID: z.string(),
  FIELD_OBSERVACOES_ID: z.string(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
});

export const env = EnvSchema.parse(process.env);

export type Env = z.infer<typeof EnvSchema>;
