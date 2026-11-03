import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

/**
 * Cliente de banco aceito pelos repositórios: o `prisma` global ou o cliente
 * de uma transação em andamento. Repositórios recebem `db` como último parâmetro
 * (padrão: prisma) e NÃO decidem sobre transações.
 */
export type DbClient = Prisma.TransactionClient;

export interface OpcoesTransacao {
  /**
   * 'serializavel' evita anomalias em sequências "ler -> decidir -> gravar" concorrentes.
   * Conflitos viram P2034, mapeado para 409 pelo handler global (o cliente pode repetir).
   */
  isolamento?: 'padrao' | 'serializavel';
}

/**
 * PADRÃO DE TRANSAÇÕES
 * Quem decide é o SERVICE (camada de negócio), explicitamente, com a justificativa
 * em comentário. Use transação quando houver:
 *   1. mais de uma escrita que precisa ser atômica (ex.: equipamento + status do lote);
 *   2. "ler -> decidir -> gravar" em que a leitura pode ser invalidada por concorrência
 *      (ex.: contar administradores antes de rebaixar um deles).
 * Não use para leituras simples, escrita única ou quando o banco já garante
 * a invariante (constraint unique, optimistic locking por `version`).
 */
export function executarEmTransacao<T>(
  operacao: (tx: DbClient) => Promise<T>,
  opcoes: OpcoesTransacao = {}
): Promise<T> {
  return prisma.$transaction(operacao, {
    maxWait: 5_000,
    timeout: 10_000,
    isolationLevel:
      opcoes.isolamento === 'serializavel' ? Prisma.TransactionIsolationLevel.Serializable : undefined,
  });
}
