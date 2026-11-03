import { prisma } from '../persistence/prisma.js';
import type { Transacao } from '../persistence/transaction.js';
import type { StatusRastreamento } from '../domain/shared/enums.js';

export interface ContagemPorStatus {
  statusRastreamento: StatusRastreamento;
  total: number;
}

export interface MetricasEquipamentos {
  totalEquipamentos: number;
  pesoTotalKg: number;
}

export interface RelatorioRepository {
  contarEquipamentosPorStatus(tx?: Transacao): Promise<ContagemPorStatus[]>;
  obterMetricasGerais(tx?: Transacao): Promise<MetricasEquipamentos>;
  obterMetricasPorOrganizacao(organizacaoId: string, tx?: Transacao): Promise<MetricasEquipamentos>;
}

/** Consultas agregadas somente leitura; por isso não segue o contrato CRUD. */
class PrismaRelatorioRepository implements RelatorioRepository {
  async contarEquipamentosPorStatus(tx?: Transacao) {
    const grupos = await (tx ?? prisma).equipamento.groupBy({
      by: ['statusRastreamento'],
      _count: { id: true },
    });
    return grupos.map((g) => ({ statusRastreamento: g.statusRastreamento, total: g._count.id }));
  }

  async obterMetricasGerais(tx?: Transacao) {
    const r = await (tx ?? prisma).equipamento.aggregate({ _sum: { pesoQuilogramas: true }, _count: { id: true } });
    return { totalEquipamentos: r._count.id, pesoTotalKg: r._sum.pesoQuilogramas ?? 0 };
  }

  async obterMetricasPorOrganizacao(organizacaoId: string, tx?: Transacao) {
    const r = await (tx ?? prisma).equipamento.aggregate({
      where: { lote: { organizacaoId } },
      _sum: { pesoQuilogramas: true },
      _count: { id: true },
    });
    return { totalEquipamentos: r._count.id, pesoTotalKg: r._sum.pesoQuilogramas ?? 0 };
  }
}

export const RelatorioRepository: RelatorioRepository = new PrismaRelatorioRepository();
