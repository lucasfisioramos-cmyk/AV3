import type { Transacao } from '../persistence/transaction.js';

/**
 * Contrato padrão dos repositórios (Usuario, Organizacao, Lote, Equipamento).
 *
 *  - Repositórios fazem APENAS persistência: nenhuma regra de negócio e nenhuma decisão
 *    de transação. O último parâmetro `tx` (opcional) executa a operação dentro da
 *    transação aberta pelo service via `executarEmTransacao`.
 *  - `findById` retorna null quando não existe. `update` e `delete` de um id inexistente
 *    lançam erro de persistência (P2025 -> 404 no handler global); o service verifica
 *    a existência antes quando quiser uma mensagem específica.
 *  - Consultas devolvem somente os campos necessários; nunca dados sensíveis por padrão.
 *  - Leituras específicas de um caso de uso (detalhes, resumos) ficam em métodos nomeados
 *    à parte (ex.: `findDetalheById`), sem alterar o contrato abaixo.
 */
export interface PaginacaoFiltro {
  skip?: number;
  take?: number;
}

export interface CrudRepository<Entity, CriarData, AtualizarData, Filtro = Record<string, never>> {
  findById(id: string, tx?: Transacao): Promise<Entity | null>;
  findAll(filtro?: Filtro, tx?: Transacao): Promise<Entity[]>;
  create(data: CriarData, tx?: Transacao): Promise<Entity>;
  update(id: string, data: AtualizarData, tx?: Transacao): Promise<Entity>;
  delete(id: string, tx?: Transacao): Promise<void>;
  count(filtro?: Filtro, tx?: Transacao): Promise<number>;
}
