import { z } from 'zod';

export const contratoAlfaSchema = z.object({
  contractNumber: z.string(),
  originalAmountCents: z.number(),
  currentAmountCents: z.number(),
  dueDate: z.string(),
  status: z.string(),
});

export const itemAlfaSchema = z.object({
  externalId: z.string(),
  taxId: z.string(),
  customerName: z.string(),
  contracts: z.array(contratoAlfaSchema),
  contacts: z
    .object({
      phones: z.array(z.string()).default([]),
      emails: z.array(z.string()).default([]),
    })
    .default({ phones: [], emails: [] }),
  updatedAt: z.string(),
});

export const paginaAlfaSchema = z.object({
  data: z.array(z.unknown()),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type ItemAlfa = z.infer<typeof itemAlfaSchema>;
export type ContratoAlfa = z.infer<typeof contratoAlfaSchema>;

export interface ItemAlfaAchatado {
  externalId: string;
  taxId: string;
  customerName: string;
  contract: ContratoAlfa;
  phones: string[];
  emails: string[];
}
