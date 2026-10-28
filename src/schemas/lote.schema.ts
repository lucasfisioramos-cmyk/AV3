import { z } from 'zod';
import { envelope, listEnvelope, type IdParams } from './common.schema.js';
import { equipamentoSchema, loteSchema, organizacaoSchema } from './entities.schema.js';

export const criarLoteBodySchema = z.object({
  organizacaoId: z.uuid(),
  notaFiscal: z.string().trim().min(1).max(60),
  transportadora: z.string().trim().min(1).max(150),
  observacoes: z.string().trim().max(1000).optional(),
});
export type CriarLoteBody = z.infer<typeof criarLoteBodySchema>;

export type CriarLoteRoute = { Body: CriarLoteBody };
export type BuscarLoteRoute = { Params: IdParams };

export const loteCriadoResponseSchema = envelope(loteSchema);

export const loteListaItemSchema = loteSchema.extend({
  organizacao: organizacaoSchema.pick({ id: true, razaoSocial: true, cnpj: true }),
  _count: z.object({ equipamentos: z.number().int() }),
});
export const listarLotesResponseSchema = listEnvelope(loteListaItemSchema);

export const loteDetalheSchema = loteSchema.extend({
  organizacao: organizacaoSchema,
  equipamentos: z.array(equipamentoSchema),
});
export const loteDetalheResponseSchema = envelope(loteDetalheSchema);
