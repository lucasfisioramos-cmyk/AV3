import { z } from 'zod';
import { envelope, listEnvelope, paginacaoQuerySchema, type IdParams } from './common.schema.js';
import { equipamentoSchema, loteSchema, organizacaoResumoSchema, statusLoteSchema } from './entities.schema.js';

export const criarLoteBodySchema = z.object({
  organizacaoId: z.uuid(),
  notaFiscal: z.string().trim().min(1).max(60),
  transportadora: z.string().trim().min(1).max(150),
  observacoes: z.string().trim().max(1000).optional(),
  dataEntrada: z.string().datetime().optional(),
});
export type CriarLoteBody = z.infer<typeof criarLoteBodySchema>;

export const atualizarStatusLoteBodySchema = z.object({
  status: statusLoteSchema,
});
export type AtualizarStatusLoteBody = z.infer<typeof atualizarStatusLoteBodySchema>;

export const editarLoteBodySchema = z
  .object({
    transportadora: z.string().trim().min(1).max(150).optional(),
    observacoes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: 'Informe ao menos um campo para atualização (transportadora ou observacoes).',
  });
export type EditarLoteBody = z.infer<typeof editarLoteBodySchema>;

export const listarLotesQuerySchema = paginacaoQuerySchema.extend({
  organizacaoId: z.uuid().optional(),
  status: statusLoteSchema.optional(),
  dataEntradaInicio: z.string().datetime().optional(),
  dataEntradaFim: z.string().datetime().optional(),
});
export type ListarLotesQuery = z.infer<typeof listarLotesQuerySchema>;

export type ListarLotesRoute = { Querystring: ListarLotesQuery };
export type CriarLoteRoute = { Body: CriarLoteBody };
export type BuscarLoteRoute = { Params: IdParams };
export type AtualizarStatusLoteRoute = { Params: IdParams; Body: AtualizarStatusLoteBody };
export type EditarLoteRoute = { Params: IdParams; Body: EditarLoteBody };
export type ExcluirLoteRoute = { Params: IdParams };

export const loteCriadoResponseSchema = envelope(loteSchema);
export const loteAtualizadoResponseSchema = envelope(loteSchema);
export const loteExcluidoResponseSchema = envelope(z.null());

export const loteListaItemSchema = loteSchema.extend({
  organizacao: organizacaoResumoSchema,
  totalEquipamentos: z.number().int(),
});
export const listarLotesResponseSchema = listEnvelope(loteListaItemSchema);

export const loteDetalheSchema = loteSchema.extend({
  organizacao: organizacaoResumoSchema,
  equipamentos: z.array(equipamentoSchema),
});
export const loteDetalheResponseSchema = envelope(loteDetalheSchema);
