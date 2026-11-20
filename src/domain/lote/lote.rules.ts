import { StatusLote, StatusRastreamento } from '../shared/enums.js';
import { ConflictError, RegraDeNegocioError } from '../../errors/app-error.js';
import { exigirValido } from '../shared/guards.js';
import { validarDataEntrada } from '../validators/index.js';

/**
 * Matriz de transições permitidas para o ciclo de vida do Lote:
 * RECEBIDO -> EM_TRIAGEM -> TRIAGEM_CONCLUIDA -> ENCAMINHADO -> FINALIZADO
 */
const TRANSICOES_VALIDAS: Record<StatusLote, readonly StatusLote[]> = {
  [StatusLote.RECEBIDO]: [StatusLote.EM_TRIAGEM],
  [StatusLote.EM_TRIAGEM]: [StatusLote.TRIAGEM_CONCLUIDA],
  [StatusLote.TRIAGEM_CONCLUIDA]: [StatusLote.ENCAMINHADO],
  [StatusLote.ENCAMINHADO]: [StatusLote.FINALIZADO],
  [StatusLote.FINALIZADO]: [],
};

export const LoteRules = {
  /** 🔒 REGRA LEGADA (AV1): data de entrada não pode ser futura nem anterior a 90 dias. */
  exigirDataEntradaValida(dataEntrada: Date, agora: Date = new Date()): void {
    exigirValido(validarDataEntrada(dataEntrada, agora), (motivo) => `Regra Violada: ${motivo}`);
  },

  garantirNotaFiscalInedita(notaFiscal: string, existente: unknown): void {
    if (existente) {
      throw new ConflictError(
        `Já existe um lote cadastrado com a Nota Fiscal "${notaFiscal}" para esta organização.`
      );
    }
  },

  /** O primeiro equipamento cadastrado move o lote de RECEBIDO para EM_TRIAGEM. */
  deveIniciarTriagem(lote: { statusProcessamento: StatusLote }): boolean {
    return lote.statusProcessamento === StatusLote.RECEBIDO;
  },

  /** Valida transições de estado do lote na máquina de estados, bloqueando saltos e retrocessos. */
  exigirTransicaoValida(statusAtual: StatusLote, novoStatus: StatusLote): void {
    if (statusAtual === novoStatus) {
      throw new RegraDeNegocioError(`O lote já se encontra no status '${statusAtual}'.`);
    }

    const permitidos = TRANSICOES_VALIDAS[statusAtual] ?? [];
    if (!permitidos.includes(novoStatus)) {
      throw new RegraDeNegocioError(
        `Transição de status inválida: não é permitido transitar de '${statusAtual}' para '${novoStatus}'.`
      );
    }
  },

  /**
   * Transição para TRIAGEM_CONCLUIDA exige que o lote possua ao menos 1 equipamento (1..*)
   * e que nenhum equipamento permaneça com status AGUARDANDO_TRIAGEM.
   */
  exigirCondicoesParaTriagemConcluida(equipamentos: Array<{ statusRastreamento: StatusRastreamento }>): void {
    if (equipamentos.length === 0) {
      throw new RegraDeNegocioError(
        'A transição para TRIAGEM_CONCLUIDA exige que o lote possua ao menos um equipamento cadastrado.'
      );
    }

    const temAguardando = equipamentos.some(
      (e) => e.statusRastreamento === StatusRastreamento.AGUARDANDO_TRIAGEM
    );
    if (temAguardando) {
      throw new RegraDeNegocioError(
        'A transição para TRIAGEM_CONCLUIDA exige que nenhum equipamento permaneça com status AGUARDANDO_TRIAGEM.'
      );
    }
  },

  /** Bloqueia adição ou alteração de equipamentos em lotes com triagem concluída ou em fase posterior. */
  exigirLoteAbertoParaEquipamentos(lote: { statusProcessamento: StatusLote }): void {
    if (
      lote.statusProcessamento !== StatusLote.RECEBIDO &&
      lote.statusProcessamento !== StatusLote.EM_TRIAGEM
    ) {
      throw new RegraDeNegocioError(
        `Não é permitido adicionar ou alterar equipamentos em um lote com status '${lote.statusProcessamento}'.`
      );
    }
  },

  /** Edição de transportadora e observações é permitida enquanto o lote não estiver FINALIZADO. */
  exigirPodeEditar(lote: { statusProcessamento: StatusLote }): void {
    if (lote.statusProcessamento === StatusLote.FINALIZADO) {
      throw new RegraDeNegocioError('Lotes finalizados não podem ser alterados.');
    }
  },

  /** Exclusão de lote é permitida apenas em status RECEBIDO e sem equipamentos vinculados. */
  exigirPodeExcluir(lote: { statusProcessamento: StatusLote }, totalEquipamentos: number): void {
    if (lote.statusProcessamento !== StatusLote.RECEBIDO) {
      throw new RegraDeNegocioError(
        `Não é permitido excluir um lote no status '${lote.statusProcessamento}'. Apenas lotes 'RECEBIDO' podem ser excluídos.`
      );
    }
    if (totalEquipamentos > 0) {
      throw new RegraDeNegocioError('Não é permitido excluir um lote que possui equipamentos vinculados.');
    }
  },
};
