import { z } from 'zod';
import { envelope, listEnvelope, paginacaoQuerySchema, type IdParams } from './common.schema.js';
import { organizacaoDetalheSchema, organizacaoSchema } from './entities.schema.js';

export const criarOrganizacaoBodySchema = z.object({
  razaoSocial: z.string().trim().min(1).max(200),
  // Aceita com ou sem máscara; o checksum é validado na camada de domínio.
  cnpj: z.string().trim().min(14).max(18),
  inscricaoEstadual: z.string().trim().min(1).max(30).optional(),
  enderecoCompleto: z.string().trim().min(1).max(300),
  telefone: z.string().trim().min(1).max(30).optional(),
  email: z.email().max(200),
});
export type CriarOrganizacaoBody = z.infer<typeof criarOrganizacaoBodySchema>;

export const editarOrganizacaoBodySchema = z
  .object({
    razaoSocial: z.string().trim().min(1).max(200).optional(),
    enderecoCompleto: z.string().trim().min(1).max(300).optional(),
    telefone: z.string().trim().min(1).max(30).optional(),
    email: z.email().max(200).optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: 'Informe ao menos um campo para atualização (razaoSocial, enderecoCompleto, telefone ou email).',
  });
export type EditarOrganizacaoBody = z.infer<typeof editarOrganizacaoBodySchema>;

export const listarOrganizacoesQuerySchema = paginacaoQuerySchema.extend({
  ativo: z.coerce.boolean().optional(),
  cnpj: z.string().trim().optional(),
  razaoSocial: z.string().trim().optional(),
});
export type ListarOrganizacoesQuery = z.infer<typeof listarOrganizacoesQuerySchema>;

export type ListarOrganizacoesRoute = { Querystring: ListarOrganizacoesQuery };
export type CriarOrganizacaoRoute = { Body: CriarOrganizacaoBody };
export type BuscarOrganizacaoRoute = { Params: IdParams };
export type EditarOrganizacaoRoute = { Params: IdParams; Body: EditarOrganizacaoBody };
export type DesativarOrganizacaoRoute = { Params: IdParams };

export const listarOrganizacoesResponseSchema = listEnvelope(organizacaoSchema);
export const organizacaoResponseSchema = envelope(organizacaoSchema);
export const organizacaoDetalheResponseSchema = envelope(organizacaoDetalheSchema);
