import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { mapError } from './error-mapper.js';

/** Handler global registrado com app.setErrorHandler(). */
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const mapped = mapError(error);

  if (mapped.shouldLogAsError) {
    request.log.error({ err: error }, 'Erro não tratado na requisição');
  } else {
    request.log.warn({ err: { name: error.name, message: error.message } }, 'Requisição rejeitada');
  }

  return reply.status(mapped.statusCode).send({
    statusCode: mapped.statusCode,
    error: mapped.error,
    message: mapped.message,
  });
}
