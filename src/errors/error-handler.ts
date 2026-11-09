import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { erroParaLog, mapError } from './error-mapper.js';

/** Handler global registrado com app.setErrorHandler(). */
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const mapped = mapError(error);
  const err = erroParaLog(error);

  if (mapped.shouldLogAsError) {
    request.log.error({ err, statusCode: mapped.statusCode }, 'Erro não tratado na requisição');
  } else {
    // Sem a stack: erros esperados (validação, regra de negócio, 401/403) não são falhas do servidor.
    const { stack: _stack, ...semStack } = err;
    request.log.warn({ err: semStack, statusCode: mapped.statusCode }, 'Requisição rejeitada');
  }

  return reply.status(mapped.statusCode).send({
    statusCode: mapped.statusCode,
    error: mapped.error,
    message: mapped.message,
    ...(mapped.details ? { details: mapped.details } : {}),
  });
}
