import { z } from 'zod';
import { envelope } from './common.schema.js';
import { contratoSchema } from './entities.schema.js';

export const criarContratoBodySchema = z.object({
  dataAssinatura: z.coerce.date(),
  dataVencimento: z.coerce.date(),
  clausulas: z.array(z.string().trim().min(1)).min(1),
  valorMensal: z.number().positive(),
  renovacaoAutomatica: z.boolean().default(true),
});
export type CriarContratoBody = z.infer<typeof criarContratoBodySchema>;
export type CriarContratoRoute = {
  Params: { id: string };
  Body: CriarContratoBody;
};

export const renovarContratoBodySchema = z.object({
  novoVencimento: z.coerce.date(),
});
export type RenovarContratoBody = z.infer<typeof renovarContratoBodySchema>;
export type RenovarContratoRoute = {
  Params: { id: string };
  Body: RenovarContratoBody;
};

export type ContratoRoute = {
  Params: { id: string };
};

export const contratoResponseSchema = envelope(contratoSchema);
export type ContratoResponse = z.infer<typeof contratoResponseSchema>;

export const encerrarContratoResponseSchema = envelope(z.null().optional());
export type EncerrarContratoResponse = z.infer<typeof encerrarContratoResponseSchema>;
