import { STATUS_CODES } from 'node:http';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { AppError } from './app-error.js';

export interface ValidationDetail {
  /** Onde ocorreu: body, params, querystring ou headers. */
  local?: string;
  /** Caminho do campo (ex.: "cnpj" ou "itens.0.nome"). */
  campo: string;
  mensagem: string;
}

export interface MappedError {
  statusCode: number;
  error: string;
  message: string;
  details?: ValidationDetail[];
  /** Erros 5xx (e falhas inesperadas) devem ser logados com stack completo. */
  shouldLogAsError: boolean;
}

const INTERNAL_MESSAGE = 'Ocorreu um erro interno no servidor.';

function build(statusCode: number, message: string): MappedError {
  return {
    statusCode,
    error: STATUS_CODES[statusCode] ?? 'Error',
    message,
    shouldLogAsError: statusCode >= 500,
  };
}

function formatTarget(target: unknown): string {
  if (Array.isArray(target)) return target.join(', ');
  if (typeof target === 'string') return target;
  return '';
}

function mapPrismaKnownError(err: PrismaClientKnownRequestError): MappedError {
  switch (err.code) {
    case 'P2002': {
      const campos = formatTarget(err.meta?.target);
      return build(409, campos ? `Já existe um registro com o mesmo valor para: ${campos}.` : 'Registro duplicado.');
    }
    case 'P2025':
      return build(404, 'Registro não encontrado.');
    case 'P2003':
      return build(409, 'Operação inválida: o registro possui vínculo com outros dados.');
    case 'P2034':
      return build(409, 'Conflito de concorrência. Tente novamente.');
    case 'P2000':
      return build(400, 'Um dos valores informados excede o tamanho permitido.');
    case 'P1001':
    case 'P1002':
    case 'P1008':
    case 'P1017':
      return build(503, 'Banco de dados indisponível. Tente novamente em instantes.');
    default:
      return build(500, INTERNAL_MESSAGE);
  }
}

interface FastifyValidationIssue {
  instancePath?: string;
  message?: string;
  params?: { missingProperty?: string };
}

function hasValidationIssues(
  err: unknown
): err is { validation: FastifyValidationIssue[]; validationContext?: string } {
  return typeof err === 'object' && err !== null && Array.isArray((err as { validation?: unknown }).validation);
}

/** Converte os issues de validação (Zod ou AJV) em detalhes por campo. */
function mapValidationIssues(err: { validation: FastifyValidationIssue[]; validationContext?: string }): MappedError {
  const details = err.validation.map((issue): ValidationDetail => {
    const caminho = (issue.instancePath ?? '').split('/').filter(Boolean);
    if (issue.params?.missingProperty) caminho.push(issue.params.missingProperty);
    return {
      local: err.validationContext,
      campo: caminho.join('.'),
      mensagem: issue.message ?? 'Valor inválido.',
    };
  });
  return { ...build(400, 'Dados da requisição inválidos.'), details };
}

function hasNumericStatus(err: unknown): err is { statusCode: number; code?: string; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { statusCode?: unknown }).statusCode === 'number'
  );
}

/**
 * Converte qualquer erro lançado na aplicação em um payload HTTP padronizado.
 * Não vaza detalhes internos (queries, stack, mensagens do Prisma) ao cliente.
 */
export function mapError(error: unknown): MappedError {
  // 1. Regras de negócio, autenticação e autorização (AppError e subclasses)
  if (error instanceof AppError) {
    return build(error.statusCode, error.message);
  }

  // 2. Prisma
  if (error instanceof PrismaClientKnownRequestError) {
    return mapPrismaKnownError(error);
  }
  if (error instanceof PrismaClientValidationError) {
    return build(400, 'Dados inválidos para a operação solicitada.');
  }
  if (error instanceof PrismaClientInitializationError) {
    return build(503, 'Banco de dados indisponível. Tente novamente em instantes.');
  }

  // 3. Validação de schema (Zod/AJV) -> 400 com detalhes por campo
  if (hasValidationIssues(error)) {
    return mapValidationIssues(error);
  }

  // 4. Erros nativos do Fastify e de plugins (validação, JWT, payload, rate limit...)
  if (hasNumericStatus(error) && error.statusCode >= 400 && error.statusCode < 500) {
    if (typeof error.code === 'string' && error.code.startsWith('FST_JWT_')) {
      return build(401, 'Token de autenticação inválido ou ausente.');
    }
    return build(error.statusCode, error.message);
  }

  // 5. Qualquer outra coisa é falha inesperada
  return { ...build(500, INTERNAL_MESSAGE), shouldLogAsError: true };
}
