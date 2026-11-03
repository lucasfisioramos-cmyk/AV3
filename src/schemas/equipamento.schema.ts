import { z } from 'zod';
import { envelope, type IdParams } from './common.schema.js';
import {
  equipamentoSchema,
  estadoFisicoSchema,
  loteSchema,
  movimentacaoSchema,
  organizacaoResumoSchema,
  statusRastreamentoSchema,
  tipoEquipamentoSchema,
} from './entities.schema.js';

// ---- Requests ----
export const criarEquipamentoBodySchema = z.object({
  loteId: z.uuid(),
  tipo: tipoEquipamentoSchema,
  marca: z.string().trim().min(1).max(100),
  modelo: z.string().trim().min(1).max(100),
  // O limite superior (ano corrente) é regra de domínio e fica no service.
  anoFabricacao: z.number().int().min(1900),
  estadoFisico: estadoFisicoSchema,
  pesoQuilogramas: z.number().positive(),
});
export type CriarEquipamentoBody = z.infer<typeof criarEquipamentoBodySchema>;

export const movimentarEquipamentoBodySchema = z.object({
  novoStatus: statusRastreamentoSchema,
  origem: z.string().trim().min(1).max(200),
  destino: z.string().trim().min(1).max(200),
  responsavel: z.string().trim().min(1).max(150),
  observacao: z.string().trim().max(1000).optional(),
  version: z.number().int().min(0),
});
export type MovimentarEquipamentoBody = z.infer<typeof movimentarEquipamentoBodySchema>;

export const alterarEstadoFisicoBodySchema = z.object({
  novoEstado: estadoFisicoSchema,
  justificativa: z.string().trim().max(1000).optional(),
  version: z.number().int().min(0),
});
export type AlterarEstadoFisicoBody = z.infer<typeof alterarEstadoFisicoBodySchema>;

export const rastrearParamsSchema = z.object({ identificador: z.string().trim().min(1).max(100) });
export type RastrearParams = z.infer<typeof rastrearParamsSchema>;

export type CriarEquipamentoRoute = { Body: CriarEquipamentoBody };
export type MovimentarEquipamentoRoute = { Params: IdParams; Body: MovimentarEquipamentoBody };
export type AlterarEstadoFisicoRoute = { Params: IdParams; Body: AlterarEstadoFisicoBody };
export type RastrearEquipamentoRoute = { Params: RastrearParams };

// ---- Responses ----
export const equipamentoResponseSchema = envelope(equipamentoSchema);

export const movimentarEquipamentoResponseSchema = envelope(
  z.object({
    equipamentoAtualizado: equipamentoSchema,
    movimentacao: movimentacaoSchema,
  })
);

export const rastrearEquipamentoResponseSchema = envelope(
  equipamentoSchema.extend({
    lote: loteSchema.extend({ organizacao: organizacaoResumoSchema }),
    historicoMovimentacao: z.array(movimentacaoSchema),
  })
);
