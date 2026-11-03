import { RelatorioRepository } from '../../repositories/relatorio.repository.js';
import { LoteRepository } from '../../repositories/lote.repository.js';
import { OrganizacaoRepository } from '../../repositories/organizacao.repository.js';
import { exigirEncontrado } from '../shared/guards.js';

// Transação: NÃO em todo o módulo. São apenas leituras; pequenas diferenças entre
// contagens feitas em instantes distintos são aceitáveis para um relatório gerencial.
export class RelatorioService {
  static async obterDashboardGeral() {
    const [equipamentosPorStatus, metricasGerais, totalLotes] = await Promise.all([
      RelatorioRepository.contarEquipamentosPorStatus(),
      RelatorioRepository.obterMetricasGerais(),
      LoteRepository.count(),
    ]);

    return {
      resumoGeral: {
        totalLotes,
        totalEquipamentos: metricasGerais.totalEquipamentos,
        pesoTotalKg: metricasGerais.pesoTotalKg,
      },
      equipamentosPorStatus,
    };
  }

  static async obterRelatorioOrganizacao(organizacaoId: string) {
    const organizacao = exigirEncontrado(
      await OrganizacaoRepository.findById(organizacaoId),
      'Organização não encontrada.'
    );

    const metricas = await RelatorioRepository.obterMetricasPorOrganizacao(organizacaoId);

    return {
      organizacao: {
        id: organizacao.id,
        razaoSocial: organizacao.razaoSocial,
        cnpj: organizacao.cnpj,
      },
      metricas,
    };
  }
}
