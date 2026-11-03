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
}
