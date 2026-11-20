import { z } from 'zod';
import { envelope } from './common.schema.js';
import { papelUsuarioSchema } from './entities.schema.js';

export const loginBodySchema = z.object({
  usuario: z.string().trim().min(1),
  senha: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginBodySchema>;
export type LoginRoute = { Body: LoginBody };

export const loginResponseSchema = envelope(
  z.object({
    token: z.string(),
    usuario: z.string(),
    papel: papelUsuarioSchema,
  })
);
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const logoutResponseSchema = envelope(z.null().optional());
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
