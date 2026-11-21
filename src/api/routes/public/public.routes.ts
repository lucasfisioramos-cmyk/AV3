import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AnalyticsService } from '../../../domain/analytics/analytics.service.js';
import { EquipamentoService } from '../../../domain/equipamento/equipamento.service.js';
import { sendSuccess } from '../../../http/response.js';
import { dateTimeSchema, envelope, errors } from '../../../schemas/common.schema.js';
import {
  estadoFisicoSchema,
  statusRastreamentoSchema,
  tipoEquipamentoSchema,
} from '../../../schemas/entities.schema.js';
import { authorizeApiKey } from '../../hooks/authorize-api-key.js';
import { reportRoutes } from './report.routes.js';

export const codigoBarrasParamsSchema = z.object({
  codigoBarras: z.string().trim().min(1).max(100),
});
export type CodigoBarrasParams = z.infer<typeof codigoBarrasParamsSchema>;

export const eficienciaQuerySchema = z.object({
  periodo: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'O período deve estar no formato YYYY-MM.')
    .optional(),
});
export type EficienciaQuery = z.infer<typeof eficienciaQuerySchema>;

export const rulQuerySchema = z.object({
  tipoEquipamento: tipoEquipamentoSchema,
  marca: z.string().trim().min(1).max(100),
  modelo: z.string().trim().min(1).max(100),
});
export type RulQuery = z.infer<typeof rulQuerySchema>;

const movimentacaoPublicaSchema = z.object({
  id: z.uuid(),
  dataHora: dateTimeSchema,
  origem: z.string(),
  destino: z.string(),
  responsavel: z.string(),
  observacao: z.string().nullable(),
});

export const rastreabilidadePublicaDataSchema = z.object({
  id: z.uuid(),
  codigoBarras: z.string(),
  codigoBarrasInterno: z.string(),
  tipo: tipoEquipamentoSchema,
  marca: z.string(),
  modelo: z.string(),
  anoFabricacao: z.number().int(),
  estadoFisico: estadoFisicoSchema,
  pesoQuilogramas: z.number(),
  statusRastreamento: statusRastreamentoSchema,
  historicoMovimentacoes: z.array(movimentacaoPublicaSchema),
});

export const eficienciaPublicaDataSchema = z.object({
  mediaHoras: z.number(),
  tempoMedioHoras: z.number(),
  medianaHoras: z.number(),
  desvioPadraoHoras: z.number(),
  totalLotesAnalisados: z.number().int(),
  totalAnalisado: z.number().int(),
  gargalosPorPeriodo: z.array(
    z.object({
      periodo: z.string(),
      totalLotes: z.number().int(),
      tempoMedioHoras: z.number(),
      medianaHoras: z.number(),
      desvioPadraoHoras: z.number(),
    }),
  ),
  gargalosPorOperador: z.array(
    z.object({
      responsavel: z.string(),
      totalLotes: z.number().int(),
      tempoMedioHoras: z.number(),
    }),
  ),
  calculadoEm: dateTimeSchema,
});

export const rentabilidadePublicaItemSchema = z.object({
  estadoFisico: estadoFisicoSchema,
  marca: z.string(),
  modelo: z.string(),
  quantidade: z.number().int(),
  pesoTotalKg: z.number(),
  valorTotalEstimado: z.number(),
  valorMedioEstimado: z.number(),
  valorMedioRecuperacao: z.number(),
  medianaValorEstimado: z.number(),
  desvioPadraoValorEstimado: z.number(),
});

export const rulPublicaDataSchema = z.object({
  id: z.uuid().optional(),
  tipoEquipamento: tipoEquipamentoSchema,
  marca: z.string(),
  modelo: z.string(),
  totalAmostras: z.number().int(),
  slope: z.number(),
  intercept: z.number(),
  idadeAtualMediaDias: z.number(),
  indiceSaudeMedioAtual: z.number(),
  indiceSaudeProjetadoAtual: z.number(),
  estimatedDaysLeft: z.number().int(),
  predictedEndDate: dateTimeSchema,
  createdAt: dateTimeSchema.optional(),
});

export const rastreabilidadePublicaResponseSchema = envelope(rastreabilidadePublicaDataSchema);
export const eficienciaPublicaResponseSchema = envelope(eficienciaPublicaDataSchema);
export const rentabilidadePublicaResponseSchema = envelope(
  z.array(rentabilidadePublicaItemSchema),
);
export const rulPublicaResponseSchema = envelope(rulPublicaDataSchema);

export async function publicRoutes(app: FastifyInstance) {
  const publicRateLimiter = app.rateLimit({
    keyGenerator: (req) => req.apiKey?.id ?? req.ip,
    max: (req) => req.apiKey?.rateLimit ?? 60,
    timeWindow: '1 minute',
  });

  app.get<{ Params: CodigoBarrasParams }>(
    '/rastreabilidade/:codigoBarras',
    {
      config: { rateLimit: false },
      onRequest: [authorizeApiKey('read:traceability'), publicRateLimiter],
      schema: {
        tags: ['Público - Rastreabilidade B2B'],
        summary: 'Consulta o histórico completo de rastreabilidade de um equipamento pelo código de barras',
        security: [{ apiKeyAuth: [] }],
        params: codigoBarrasParamsSchema,
        response: {
          200: rastreabilidadePublicaResponseSchema,
          ...errors(400, 401, 403, 404, 429),
        },
      },
    },
    async (request, reply) => {
      const equip = await EquipamentoService.rastrear(request.params.codigoBarras);
      return sendSuccess(reply, {
        id: equip.id,
        codigoBarras: equip.codigoBarrasInterno,
        codigoBarrasInterno: equip.codigoBarrasInterno,
        tipo: equip.tipo,
        marca: equip.marca,
        modelo: equip.modelo,
        anoFabricacao: equip.anoFabricacao,
        estadoFisico: equip.estadoFisico,
        pesoQuilogramas: equip.pesoQuilogramas,
        statusRastreamento: equip.statusRastreamento,
        historicoMovimentacoes: equip.historicoMovimentacao.map((m) => ({
          id: m.id,
          dataHora: m.dataHora,
          origem: m.origem,
          destino: m.destino,
          responsavel: m.responsavel,
          observacao: m.observacao,
        })),
      });
    },
  );

  app.get<{ Querystring: EficienciaQuery }>(
    '/analytics/eficiencia',
    {
      config: { rateLimit: false },
      onRequest: [authorizeApiKey('read:analytics'), publicRateLimiter],
      schema: {
        tags: ['Público - Analytics B2B'],
        summary: 'Calcula e retorna métricas estatísticas de eficiência operacional de lotes',
        security: [{ apiKeyAuth: [] }],
        querystring: eficienciaQuerySchema,
        response: {
          200: eficienciaPublicaResponseSchema,
          ...errors(400, 401, 403, 429),
        },
      },
    },
    async (request, reply) => {
      const resultado = await AnalyticsService.gerarAnaliseEficiencia(request.query.periodo);
      return sendSuccess(reply, {
        mediaHoras: resultado.tempoMedioHoras,
        tempoMedioHoras: resultado.tempoMedioHoras,
        medianaHoras: resultado.medianaHoras,
        desvioPadraoHoras: resultado.desvioPadraoHoras,
        totalLotesAnalisados: resultado.totalAnalisado,
        totalAnalisado: resultado.totalAnalisado,
        gargalosPorPeriodo: resultado.gargalosPorPeriodo,
        gargalosPorOperador: resultado.gargalosPorOperador,
        calculadoEm: resultado.calculadoEm,
      });
    },
  );

  app.get(
    '/analytics/rentabilidade',
    {
      config: { rateLimit: false },
      onRequest: [authorizeApiKey('read:analytics'), publicRateLimiter],
      schema: {
        tags: ['Público - Analytics B2B'],
        summary: 'Calcula e retorna estimativa de recuperação financeira agrupada por estado físico, marca e modelo',
        security: [{ apiKeyAuth: [] }],
        response: {
          200: rentabilidadePublicaResponseSchema,
          ...errors(401, 403, 429),
        },
      },
    },
    async (_request, reply) => {
      const resultado = await AnalyticsService.gerarAnaliseRentabilidade();
      const itens = resultado.itens.map((item) => ({
        ...item,
        valorMedioRecuperacao: item.valorMedioEstimado,
      }));
      return sendSuccess(reply, itens, {
        meta: {
          totalAnalisado: resultado.totalAnalisado,
          valorTotalGeral: resultado.valorTotalGeral,
          valorMedioGeral: resultado.valorMedioGeral,
          calculadoEm: resultado.calculadoEm.toISOString(),
        },
      });
    },
  );

  app.get<{ Querystring: RulQuery }>(
    '/analytics/rul',
    {
      config: { rateLimit: false },
      onRequest: [authorizeApiKey('read:analytics'), publicRateLimiter],
      schema: {
        tags: ['Público - Analytics B2B'],
        summary: 'Estima a Vida Útil Remanescente (RUL) via Regressão Linear Simples (OLS)',
        security: [{ apiKeyAuth: [] }],
        querystring: rulQuerySchema,
        response: {
          200: rulPublicaResponseSchema,
          ...errors(400, 401, 403, 429),
        },
      },
    },
    async (request, reply) => {
      const { tipoEquipamento, marca, modelo } = request.query;
      const predicao = await AnalyticsService.preverVidaUtilRemanescente(
        tipoEquipamento,
        marca,
        modelo,
      );
      return sendSuccess(reply, predicao);
    },
  );

  await app.register(reportRoutes);
}
