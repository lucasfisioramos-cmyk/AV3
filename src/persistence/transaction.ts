import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

/**
 * Handle opaco de uma transação em andamento. Serviços apenas o repassam aos
 * repositórios (`tx`); quem o interpreta é a camada de persistência.
 */
export type Transacao = Prisma.TransactionClient;

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
  operacao: (tx: Transacao) => Promise<T>,
  opcoes: OpcoesTransacao = {}
): Promise<T> {
  return prisma.$transaction(operacao, {
    maxWait: 5_000,
    timeout: 10_000,
    isolationLevel:
      opcoes.isolamento === 'serializavel' ? Prisma.TransactionIsolationLevel.Serializable : undefined,
  });
}
