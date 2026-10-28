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

/** Versão para listas, documentando meta.total. */
export function listEnvelope<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    message: z.string().optional(),
    meta: z.object({ total: z.number().int() }),
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
