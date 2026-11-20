import { LoteRepository } from '../../repositories/lote.repository.js';
import { EquipamentoRepository } from '../../repositories/equipamento.repository.js';
import { OrganizacaoRepository } from '../../repositories/organizacao.repository.js';
import { executarEmTransacao } from '../../persistence/transaction.js';
import { StatusLote } from '../shared/enums.js';
import { exigirEncontrado } from '../shared/guards.js';
import { LoteRules } from './lote.rules.js';
import { OrganizacaoRules } from '../organizacao/organizacao.rules.js';

export interface CriarLoteInput {
  organizacaoId: string;
  notaFiscal: string;
  transportadora: string;
  dataEntrada?: Date | string;
  observacoes?: string;
}

export interface AtualizarStatusLoteInput {
  loteId: string;
  novoStatus: StatusLote;
}

export interface EditarLoteInput {
  transportadora?: string;
  observacoes?: string | null;
}

export interface ListarLotesInput {
  organizacaoId?: string;
  status?: StatusLote;
  dataEntradaInicio?: string | Date;
  dataEntradaFim?: string | Date;
  page?: number;
  limit?: number;
}

export class LoteService {
  // Transação: NÃO. Escrita única. Limitação conhecida: não há constraint unique
  // (notaFiscal, organizacaoId) no schema; a checagem abaixo não cobre requisições simultâneas.
  static async criarLote(data: CriarLoteInput) {
    const organizacao = exigirEncontrado(
      await OrganizacaoRepository.findById(data.organizacaoId),
      'Organização de origem não encontrada.'
    );
    OrganizacaoRules.exigirOrganizacaoAtiva(organizacao, 'receber novos lotes');

    const dataEntrada = data.dataEntrada ? new Date(data.dataEntrada) : new Date();
    LoteRules.exigirDataEntradaValida(dataEntrada);

    const loteExistente = await LoteRepository.findByNotaFiscalEOrganizacao(
      data.notaFiscal,
      data.organizacaoId
    );
    LoteRules.garantirNotaFiscalInedita(data.notaFiscal, loteExistente);

    return LoteRepository.create({
      organizacaoId: data.organizacaoId,
      notaFiscal: data.notaFiscal,
      transportadora: data.transportadora,
      observacoes: data.observacoes,
      dataEntrada,
      statusProcessamento: StatusLote.RECEBIDO, // todo lote nasce como RECEBIDO
    });
  }

  static async atualizarStatus(input: AtualizarStatusLoteInput) {
    return executarEmTransacao(async (tx) => {
      const lote = exigirEncontrado(
        await LoteRepository.findById(input.loteId, tx),
        'Lote não encontrado.'
      );

      LoteRules.exigirTransicaoValida(lote.statusProcessamento, input.novoStatus);

      if (input.novoStatus === StatusLote.TRIAGEM_CONCLUIDA) {
        const equipamentos = await EquipamentoRepository.findAll({ loteId: input.loteId }, tx);
        LoteRules.exigirCondicoesParaTriagemConcluida(equipamentos);
      }

      return LoteRepository.update(input.loteId, { statusProcessamento: input.novoStatus }, tx);
    });
  }

  static async listarLotes(params: ListarLotesInput = {}) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const filtro = {
      organizacaoId: params.organizacaoId,
      statusProcessamento: params.status,
      dataEntradaInicio: params.dataEntradaInicio ? new Date(params.dataEntradaInicio) : undefined,
      dataEntradaFim: params.dataEntradaFim ? new Date(params.dataEntradaFim) : undefined,
      skip,
      take: limit,
    };

    const countFiltro = {
      organizacaoId: params.organizacaoId,
      statusProcessamento: params.status,
      dataEntradaInicio: filtro.dataEntradaInicio,
      dataEntradaFim: filtro.dataEntradaFim,
    };

    const [itens, total] = await Promise.all([
      LoteRepository.listarComResumo(filtro),
      LoteRepository.count(countFiltro),
    ]);

    return { itens, total, page, limit };
  }

  static async buscarPorId(id: string) {
    return exigirEncontrado(await LoteRepository.findDetalheById(id), 'Lote não encontrado.');
  }

  static async editarLote(id: string, data: EditarLoteInput) {
    const lote = exigirEncontrado(
      await LoteRepository.findById(id),
      'Lote não encontrado.'
    );

    LoteRules.exigirPodeEditar(lote);

    return LoteRepository.update(id, data);
  }

  static async excluirLote(id: string) {
    const lote = exigirEncontrado(
      await LoteRepository.findById(id),
      'Lote não encontrado.'
    );

    const totalEquipamentos = await EquipamentoRepository.count({ loteId: id });
    LoteRules.exigirPodeExcluir(lote, totalEquipamentos);

    await LoteRepository.delete(id);
  }
}
