import type { FastifyReply } from 'fastify';

/** Envelope padrão de TODAS as respostas de sucesso da API. */
export interface ApiResponse<T> {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

interface SendOptions {
  status?: number;
  message?: string;
  meta?: Record<string, unknown>;
}

export function sendSuccess<T>(reply: FastifyReply, data: T, options: SendOptions = {}) {
  const body: ApiResponse<T> = { data };
  if (options.message !== undefined) body.message = options.message;
  if (options.meta !== undefined) body.meta = options.meta;
  return reply.status(options.status ?? 200).send(body);
}

export const sendCreated = <T>(reply: FastifyReply, data: T, options: Omit<SendOptions, 'status'> = {}) =>
  sendSuccess(reply, data, { ...options, status: 201 });

/** Listas: `data` é o array e `meta.total` a quantidade de itens retornados. */
export const sendList = <T>(reply: FastifyReply, items: T[], options: Omit<SendOptions, 'status'> = {}) =>
  sendSuccess(reply, items, { ...options, meta: { total: items.length, ...options.meta } });
