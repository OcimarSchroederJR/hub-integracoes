import { z } from 'zod';

export const envSchema = z.object({
  APP_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  PARCEIRO_ALFA_BASE_URL: z.string().url(),
  PARCEIRO_ALFA_TOKEN: z.string().min(1),
  PARCEIRO_ALFA_RATE_LIMIT_POR_MINUTO: z.coerce.number().int().positive().default(60),
  PARCEIRO_BETA_CSV_URL: z.string().url(),
  PARCEIRO_BETA_WEBHOOK_URL: z.string().url(),
  AWS_ENDPOINT: z.string().url().optional(),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET_RAW: z.string().min(1).default('hub-raw-payloads'),
  FILA_CONCORRENCIA_NORMALIZACAO: z.coerce.number().int().positive().default(10),
  FILA_TENTATIVAS_MAXIMAS: z.coerce.number().int().positive().default(5),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validarEnv(config: Record<string, unknown>): EnvConfig {
  const resultado = envSchema.safeParse(config);
  if (!resultado.success) {
    const detalhes = resultado.error.issues
      .map((problema) => `${problema.path.join('.')}: ${problema.message}`)
      .join('; ');
    throw new Error(`Configuração de ambiente inválida — ${detalhes}`);
  }
  return resultado.data;
}
