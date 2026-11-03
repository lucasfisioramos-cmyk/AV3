import { z } from 'zod';
import { envelope } from './common.schema.js';
import { statusRastreamentoSchema } from './entities.schema.js';

export const dashboardResponseSchema = envelope(
  z.object({
    resumoGeral: z.object({
      totalLotes: z.number().int(),
      totalEquipamentos: z.number().int(),
      pesoTotalKg: z.number(),
    }),
    equipamentosPorStatus: z.array(
      z.object({
        statusRastreamento: statusRastreamentoSchema,
        total: z.number().int(),
      })
    ),
  })
);

export const relatorioOrganizacaoResponseSchema = envelope(
  z.object({
    organizacao: z.object({ id: z.string(), razaoSocial: z.string(), cnpj: z.string() }),
    metricas: z.object({ totalEquipamentos: z.number().int(), pesoTotalKg: z.number() }),
  })
);
