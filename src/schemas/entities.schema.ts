import { z } from 'zod';
import { EstadoFisico, PapelUsuario, StatusLote, StatusRastreamento, TipoEquipamento } from '../domain/shared/enums.js';
import { dateTimeSchema } from './common.schema.js';

export const papelUsuarioSchema = z.enum(PapelUsuario);
export const tipoEquipamentoSchema = z.enum(TipoEquipamento);
export const estadoFisicoSchema = z.enum(EstadoFisico);
export const statusRastreamentoSchema = z.enum(StatusRastreamento);
export const statusLoteSchema = z.enum(StatusLote);

export const organizacaoSchema = z.object({
  id: z.string(),
  razaoSocial: z.string(),
  cnpj: z.string(),
  inscricaoEstadual: z.string().nullable(),
  enderecoCompleto: z.string(),
  telefone: z.string(),
  email: z.string(),
  dataCadastro: dateTimeSchema,
  ativo: z.boolean(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const organizacaoResumoSchema = organizacaoSchema.pick({ id: true, razaoSocial: true, cnpj: true });

export const contratoSchema = z.object({
  id: z.string(),
  organizacaoId: z.string(),
  dataAssinatura: dateTimeSchema,
  dataVencimento: dateTimeSchema,
  clausulas: z.array(z.string()),
  valorMensal: z.number().positive(),
  renovacaoAutomatica: z.boolean(),
  ativo: z.boolean(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const organizacaoDetalheSchema = organizacaoSchema.extend({
  contratoVigente: contratoSchema.nullable(),
});

export const loteSchema = z.object({
  id: z.string(),
  dataEntrada: dateTimeSchema,
  organizacaoId: z.string(),
  notaFiscal: z.string(),
  transportadora: z.string(),
  statusProcessamento: statusLoteSchema,
  observacoes: z.string().nullable(),
  version: z.number().int(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const equipamentoSchema = z.object({
  id: z.string(),
  codigoBarrasInterno: z.string(),
  tipo: tipoEquipamentoSchema,
  marca: z.string(),
  modelo: z.string(),
  anoFabricacao: z.number().int(),
  estadoFisico: estadoFisicoSchema,
  pesoQuilogramas: z.number(),
  loteId: z.string(),
  posicaoNoLote: z.number().int(),
  statusRastreamento: statusRastreamentoSchema,
  version: z.number().int(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const movimentacaoSchema = z.object({
  id: z.string(),
  equipamentoId: z.string(),
  dataHora: dateTimeSchema,
  origem: z.string(),
  destino: z.string(),
  responsavel: z.string(),
  observacao: z.string().nullable(),
  createdAt: dateTimeSchema,
});
