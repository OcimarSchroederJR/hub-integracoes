import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export type LoginDto = z.infer<typeof loginSchema>;
