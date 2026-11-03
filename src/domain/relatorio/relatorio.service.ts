import { RelatorioRepository } from '../../repositories/relatorio.repository.js';
import { OrganizacaoRepository } from '../../repositories/organizacao.repository.js';
import { exigirEncontrado } from '../shared/guards.js';

// Transação: NÃO em todo o módulo. São apenas leituras; pequenas diferenças entre
// contagens feitas em instantes distintos são aceitáveis para um relatório gerencial.
export class RelatorioService {
  static async obterDashboardGeral() {
    const [equipamentosPorStatus, metricasGerais, totalLotes] = await Promise.all([
      RelatorioRepository.countEquipamentosPorStatus(),
      RelatorioRepository.aggregateMetricasGerais(),
      RelatorioRepository.countTotalLotes(),
    ]);

    return {
      resumoGeral: {
        totalLotes,
        totalEquipamentos: metricasGerais._count.id,
        pesoTotalKg: metricasGerais._sum.pesoQuilogramas || 0,
      },
      equipamentosPorStatus,
    };
  }

  static async obterRelatorioOrganizacao(organizacaoId: string) {
    const organizacao = exigirEncontrado(
      await OrganizacaoRepository.findById(organizacaoId),
      'Organização não encontrada.'
    );

    const metricas = await RelatorioRepository.aggregateMetricasPorOrganizacao(organizacaoId);

    return {
      organizacao: {
        id: organizacao.id,
        razaoSocial: organizacao.razaoSocial,
        cnpj: organizacao.cnpj,
      },
      metricas: {
        totalEquipamentos: metricas._count.id,
        pesoTotalKg: metricas._sum.pesoQuilogramas || 0,
      },
    };
  }
}
