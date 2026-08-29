import { z } from 'zod';

export const linhaBetaSchema = z.object({
  CPF_CNPJ: z.string(),
  NOME_CLIENTE: z.string(),
  NUM_CONTRATO: z.string(),
  VLR_ORIGINAL: z.string(),
  VLR_ATUALIZADO: z.string(),
  DT_VENCIMENTO: z.string(),
  TELEFONE: z.string(),
  SITUACAO: z.string(),
});

export type LinhaBeta = z.infer<typeof linhaBetaSchema>;
