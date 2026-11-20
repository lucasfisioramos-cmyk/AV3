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

export interface SendListMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface SendListOptions {
  message?: string;
  meta?: SendListMeta;
}

/** Listas: `data` é o array e `meta` contém { total, page, limit, totalPages }. */
export const sendList = <T>(
  reply: FastifyReply,
  items: T[],
  options?: SendListOptions | SendListMeta
) => {
  const isOptions = (opt: unknown): opt is SendListOptions =>
    typeof opt === 'object' && opt !== null && ('meta' in opt || 'message' in opt);

  const opts = options ?? {};
  const metaObj: SendListMeta = isOptions(opts) ? (opts.meta ?? {}) : (opts as SendListMeta);
  const message: string | undefined = isOptions(opts) ? opts.message : undefined;

  const total = metaObj.total ?? items.length;
  const page = metaObj.page ?? 1;
  const limit = metaObj.limit ?? (total > 0 ? total : 20);
  const totalPages = metaObj.totalPages ?? (total === 0 ? 0 : Math.ceil(total / limit));

  return sendSuccess(reply, items, {
    message,
    meta: {
      ...metaObj,
      total,
      page,
      limit,
      totalPages,
    },
  });
};
