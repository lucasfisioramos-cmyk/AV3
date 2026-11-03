import { Equipamento, StatusRastreamento, EstadoFisico, TipoEquipamento } from '@prisma/client';
import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';

/**
 * Persistência pura de equipamentos e movimentações.
 * Regras de negócio e decisões de transação ficam no EquipamentoService.
 */
export class EquipamentoRepository {
  // 1. Buscar Equipamento por ID
  static async findById(id: string, db: Transacao = prisma): Promise<Equipamento | null> {
    return db.equipamento.findUnique({ where: { id } });
  }

  // 2. Contar quantidade de equipamentos vinculados a um Lote (sequência do código de barras)
  static async countByLoteId(loteId: string, db: Transacao = prisma): Promise<number> {
    return db.equipamento.count({ where: { loteId } });
  }

  // 3. Buscar Equipamento por ID ou Código de Barras Interno com relacionamentos
  static async findByIdentificador(identificador: string) {
    return prisma.equipamento.findFirst({
      where: {
        OR: [{ id: identificador }, { codigoBarrasInterno: identificador }],
      },
      include: {
        lote: { include: { organizacao: true } },
        historicoMovimentacao: true,
      },
    });
  }

  // 4. Criar Equipamento
  static async create(
    data: {
      loteId: string;
      codigoBarrasInterno: string;
      tipo: TipoEquipamento;
      marca: string;
      modelo: string;
      anoFabricacao: number;
      estadoFisico: EstadoFisico;
      pesoQuilogramas: number;
      posicaoNoLote: number;
      statusRastreamento: StatusRastreamento;
    },
    db: Transacao = prisma
  ) {
    return db.equipamento.create({ data });
  }

  /**
   * 5. Atualização com Optimistic Locking: só grava se `version` ainda for a informada
   * e incrementa a versão. Retorna null quando a versão está desatualizada.
   */
  static async atualizarComVersao(
    id: string,
    versaoAtual: number,
    data: { statusRastreamento?: StatusRastreamento; estadoFisico?: EstadoFisico },
    db: Transacao = prisma
  ): Promise<Equipamento | null> {
    const { count } = await db.equipamento.updateMany({
      where: { id, version: versaoAtual },
      data: { ...data, version: { increment: 1 } },
    });

    if (count === 0) return null;
    return db.equipamento.findUnique({ where: { id } });
  }

  // 6. Registrar movimentação no histórico
  static async criarMovimentacao(
    data: {
      equipamentoId: string;
      origem: string;
      destino: string;
      responsavel: string;
      observacao?: string;
    },
    db: Transacao = prisma
  ) {
    return db.movimentacao.create({ data });
  }
}
