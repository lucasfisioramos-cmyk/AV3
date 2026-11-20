import { z } from 'zod';

/** DateTime: o serializador recebe Date (Prisma) e emite ISO 8601 no JSON. */
export const dateTimeSchema = z.codec(z.iso.datetime(), z.date(), {
  decode: (iso) => new Date(iso),
  encode: (date) => date.toISOString(),
});

export const idParamsSchema = z.object({ id: z.uuid() });
export type IdParams = z.infer<typeof idParamsSchema>;

/** Envelope de sucesso: { data, message?, meta? }. */
export function envelope<T extends z.ZodType>(data: T) {
  return z.object({
    data,
    message: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  });
}

export const paginacaoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginacaoQuery = z.infer<typeof paginacaoQuerySchema>;

export const metaPaginacaoSchema = z.object({
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});
export type MetaPaginacao = z.infer<typeof metaPaginacaoSchema>;

/** Versão para listas, documentando meta com total, page, limit e totalPages. */
export function listEnvelope<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    message: z.string().optional(),
    meta: metaPaginacaoSchema,
  });
}

export const errorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  details: z
    .array(
      z.object({
        local: z.string().optional(),
        campo: z.string(),
        mensagem: z.string(),
      })
    )
    .optional(),
});

/** Monta o bloco `response` de erros de uma rota: errors(400, 404, 409). */
export function errors(...codes: number[]) {
  return Object.fromEntries(codes.map((code) => [code, errorSchema]));
}
