import { z } from 'zod';
import { envelope, listEnvelope } from './common.schema.js';
import { organizacaoSchema } from './entities.schema.js';

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
export type CriarOrganizacaoRoute = { Body: CriarOrganizacaoBody };

export const listarOrganizacoesResponseSchema = listEnvelope(organizacaoSchema);
export const organizacaoResponseSchema = envelope(organizacaoSchema);
