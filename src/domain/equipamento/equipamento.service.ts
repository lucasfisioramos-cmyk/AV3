import { StatusRastreamento, EstadoFisico, StatusLote, TipoEquipamento } from '../shared/enums.js';
import { EquipamentoRepository } from '../../repositories/equipamento.repository.js';
import { LoteRepository } from '../../repositories/lote.repository.js';
import { executarEmTransacao } from '../../persistence/transaction.js';
import { ConflictError } from '../../errors/app-error.js';
import { exigirEncontrado } from '../shared/guards.js';
import { LoteRules } from '../lote/lote.rules.js';
import { EquipamentoRules } from './equipamento.rules.js';
import { gerarCodigoBarrasInterno } from './equipamento.codigo.js';

export interface CriarEquipamentoInput {
  loteId: string;
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisico;
  pesoQuilogramas: number;
}

export interface MovimentarEquipamentoInput {
  id: string;
  novoStatus: StatusRastreamento;
  origem: string;
  destino: string;
  responsavel: string;
  observacao?: string;
  version: number;
}

export interface AlterarEstadoFisicoInput {
  id: string;
  novoEstado: EstadoFisico;
  justificativa?: string;
  version: number;
}

export interface EditarEquipamentoInput {
  marca?: string;
  modelo?: string;
  anoFabricacao?: number;
  pesoQuilogramas?: number;
}

export interface ListarEquipamentosInput {
  loteId?: string;
  tipo?: TipoEquipamento;
  statusRastreamento?: StatusRastreamento;
  page?: number;
  limit?: number;
}

const MSG_VERSAO_MOVIMENTACAO =
  'O registro foi atualizado por outro usuário simultaneamente. Recarregue os dados e tente novamente.';
const MSG_FALHA_MOVIMENTACAO = 'Falha de concorrência ao movimentar o equipamento. Tente novamente.';
const MSG_CONFLITO_ESTADO_FISICO = 'Conflito de concorrência ao atualizar estado físico.';

export class EquipamentoService {
  // 1. Cadastrar Equipamento (ano, peso, posição e código de barras sequenciais)
  static async criarEquipamento(data: CriarEquipamentoInput) {
    EquipamentoRules.exigirAnoFabricacaoValido(data.anoFabricacao);
    EquipamentoRules.exigirPesoPositivo(data.pesoQuilogramas);

    // Transação: SIM (serializável). (a) "contar itens -> gerar posição/código -> inserir" não pode
    // intercalar com outro cadastro no mesmo lote; (b) equipamento e status do lote mudam juntos.
    return executarEmTransacao(
      async (tx) => {
        const lote = exigirEncontrado(
          await LoteRepository.findById(data.loteId, tx),
          `Lote '${data.loteId}' não encontrado.`
        );

        LoteRules.exigirLoteAbertoParaEquipamentos(lote);

        const posicaoNoLote = (await EquipamentoRepository.count({ loteId: data.loteId }, tx)) + 1;

        const equipamento = await EquipamentoRepository.create(
          {
            ...data,
            posicaoNoLote,
            codigoBarrasInterno: gerarCodigoBarrasInterno(data.loteId, data.tipo, posicaoNoLote),
            statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM,
          },
          tx
        );

        if (LoteRules.deveIniciarTriagem(lote)) {
          await LoteRepository.update(data.loteId, { statusProcessamento: StatusLote.EM_TRIAGEM }, tx);
        }

        return equipamento;
      },
      { isolamento: 'serializavel' }
    );
  }

  // 2. Movimentar Equipamento com Trava de Desmonte e Optimistic Locking
  static async movimentarEquipamento(params: MovimentarEquipamentoInput) {
    const equipamento = exigirEncontrado(
      await EquipamentoRepository.findById(params.id),
      'Equipamento não encontrado.'
    );

    EquipamentoRules.exigirTriagemAntesDoDesmonte(equipamento.statusRastreamento, params.novoStatus);
    EquipamentoRules.exigirVersaoAtual(equipamento.version, params.version, MSG_VERSAO_MOVIMENTACAO);

    // Transação: SIM. Atualização do status e registro no histórico precisam ser atômicos.
    // O optimistic locking (version) cobre a concorrência; isolamento padrão é suficiente.
    return executarEmTransacao(async (tx) => {
      const equipamentoAtualizado = await EquipamentoRepository.atualizarComVersao(
        params.id,
        params.version,
        { statusRastreamento: params.novoStatus },
        tx
      );
      // Versão mudou entre a leitura e a escrita: lançar desfaz a transação inteira.
      if (!equipamentoAtualizado) throw new ConflictError(MSG_FALHA_MOVIMENTACAO);

      const movimentacao = await EquipamentoRepository.registrarMovimentacao(
        {
          equipamentoId: params.id,
          origem: params.origem,
          destino: params.destino,
          responsavel: params.responsavel,
          observacao: params.observacao,
        },
        tx
      );

      return { equipamentoAtualizado, movimentacao };
    });
  }

  // 3. Alterar Estado Físico com Regra de Justificativa para Rebaixamento
  // Transação: NÃO. Escrita única, protegida por optimistic locking (version).
  static async alterarEstadoFisico(params: AlterarEstadoFisicoInput) {
    const equipamento = exigirEncontrado(
      await EquipamentoRepository.findById(params.id),
      'Equipamento não encontrado.'
    );

    EquipamentoRules.exigirJustificativaParaRebaixamento(
      equipamento.estadoFisico,
      params.novoEstado,
      params.justificativa
    );
    EquipamentoRules.exigirVersaoAtual(equipamento.version, params.version, MSG_CONFLITO_ESTADO_FISICO);

    const atualizado = await EquipamentoRepository.atualizarComVersao(params.id, params.version, {
      estadoFisico: params.novoEstado,
    });
    if (!atualizado) throw new ConflictError(MSG_CONFLITO_ESTADO_FISICO);

    return atualizado;
  }

  // 4. Rastrear equipamento por ID ou código de barras interno (somente leitura)
  static async rastrear(identificador: string) {
    EquipamentoRules.exigirIdentificador(identificador);

    return exigirEncontrado(
      await EquipamentoRepository.findDetalheByIdentificador(identificador),
      `Equipamento não encontrado para o identificador "${identificador}".`
    );
  }

  // 4.1 Listar equipamentos com filtros e paginação
  static async listarEquipamentos(params: ListarEquipamentosInput = {}) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const filtro = {
      loteId: params.loteId,
      tipo: params.tipo,
      statusRastreamento: params.statusRastreamento,
      skip,
      take: limit,
    };

    const countFiltro = {
      loteId: params.loteId,
      tipo: params.tipo,
      statusRastreamento: params.statusRastreamento,
    };

    const [itens, total] = await Promise.all([
      EquipamentoRepository.findAll(filtro),
      EquipamentoRepository.count(countFiltro),
    ]);

    return { itens, total, page, limit };
  }

  // 5. Editar metadados descritivos do equipamento
  static async editarEquipamento(id: string, data: EditarEquipamentoInput) {
    const equipamento = exigirEncontrado(
      await EquipamentoRepository.findById(id),
      'Equipamento não encontrado.'
    );

    const lote = exigirEncontrado(
      await LoteRepository.findById(equipamento.loteId),
      'Lote vinculado não encontrado.'
    );

    EquipamentoRules.exigirPodeEditar(lote);

    if (data.anoFabricacao !== undefined) {
      EquipamentoRules.exigirAnoFabricacaoValido(data.anoFabricacao);
    }
    if (data.pesoQuilogramas !== undefined) {
      EquipamentoRules.exigirPesoPositivo(data.pesoQuilogramas);
    }

    return EquipamentoRepository.update(id, data);
  }

  // 6. Excluir equipamento
  static async excluirEquipamento(id: string) {
    return executarEmTransacao(async (tx) => {
      const equipamento = exigirEncontrado(
        await EquipamentoRepository.findById(id, tx),
        'Equipamento não encontrado.'
      );

      const lote = exigirEncontrado(
        await LoteRepository.findById(equipamento.loteId, tx),
        'Lote vinculado não encontrado.'
      );

      const totalMovimentacoes = await EquipamentoRepository.contarMovimentacoes(id, tx);
      EquipamentoRules.exigirPodeExcluir(equipamento, totalMovimentacoes, lote);

      await EquipamentoRepository.delete(id, tx);
    });
  }
}
