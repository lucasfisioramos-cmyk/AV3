import { z } from 'zod';
import { dateTimeSchema, envelope, listEnvelope, paginacaoQuerySchema, type IdParams } from './common.schema.js';
import { papelUsuarioSchema } from './entities.schema.js';

// bcrypt ignora bytes além de 72; limitar evita senhas "truncadas" silenciosamente.
const senhaSchema = z.string().min(1).max(72);
const nomeUsuarioSchema = z.string().trim().min(1).max(100);

// ---- Requests ----
export const criarUsuarioBodySchema = z.object({
  usuario: nomeUsuarioSchema,
  senhaPlana: senhaSchema,
  papel: papelUsuarioSchema,
});
export type CriarUsuarioBody = z.infer<typeof criarUsuarioBodySchema>;

export const editarUsuarioBodySchema = z
  .object({
    usuario: nomeUsuarioSchema.optional(),
    senha: senhaSchema.optional(),
    papel: papelUsuarioSchema.optional(),
  })
  .refine((body) => Object.values(body).some((valor) => valor !== undefined), {
    message: 'Informe ao menos um campo para atualização (usuario, senha ou papel).',
  });
export type EditarUsuarioBody = z.infer<typeof editarUsuarioBodySchema>;

export const alterarMinhaSenhaBodySchema = z.object({
  senhaAtual: z.string().min(1, 'Informe a senha atual.'),
  novaSenha: senhaSchema,
});
export type AlterarMinhaSenhaBody = z.infer<typeof alterarMinhaSenhaBodySchema>;

export const listarUsuariosQuerySchema = paginacaoQuerySchema.extend({
  papel: papelUsuarioSchema.optional(),
});
export type ListarUsuariosQuery = z.infer<typeof listarUsuariosQuerySchema>;

export type ListarUsuariosRoute = { Querystring: ListarUsuariosQuery };
export type CriarUsuarioRoute = { Body: CriarUsuarioBody };
export type EditarUsuarioRoute = { Params: IdParams; Body: EditarUsuarioBody };
export type AlterarMinhaSenhaRoute = { Body: AlterarMinhaSenhaBody };
export type RemoverUsuarioRoute = { Params: IdParams };

// ---- Responses ----
export const usuarioCriadoResponseSchema = envelope(
  z.object({
    id: z.string(),
    usuario: z.string(),
    papel: papelUsuarioSchema,
    createdAt: dateTimeSchema,
  })
);

export const usuarioAtualizadoResponseSchema = envelope(
  z.object({
    id: z.string(),
    usuario: z.string(),
    papel: papelUsuarioSchema,
    updatedAt: dateTimeSchema,
  })
);

export const semConteudoResponseSchema = envelope(z.null());

export const usuarioResumoSchema = z.object({
  id: z.string(),
  usuario: z.string(),
  papel: papelUsuarioSchema,
  ultimoAcesso: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});
export type UsuarioResumo = z.infer<typeof usuarioResumoSchema>;

export const listarUsuariosResponseSchema = listEnvelope(usuarioResumoSchema);
