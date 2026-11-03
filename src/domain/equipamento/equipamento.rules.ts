import { EstadoFisico, StatusRastreamento } from '../shared/enums.js';
import { ConflictError, RegraDeNegocioError } from '../../errors/app-error.js';

// Hierarquia do estado físico (quanto maior, melhor). Base da regra de rebaixamento.
const HIERARQUIA_ESTADO_FISICO: Record<EstadoFisico, number> = {
  NOVO: 6,
  BOM_ESTADO: 5,
  USADO_LEVE: 4,
  USADO_MODERADO: 3,
  DANIFICADO_LEVE: 2,
  DANIFICADO_GRAVE: 1,
  INSERVIVEL: 0,
};

const ANO_FABRICACAO_MINIMO = 1900;
const REBAIXAMENTO_QUE_EXIGE_JUSTIFICATIVA = 2;

export const EquipamentoRules = {
  exigirAnoFabricacaoValido(ano: number, anoAtual: number = new Date().getFullYear()): void {
    if (ano < ANO_FABRICACAO_MINIMO || ano > anoAtual) {
      throw new RegraDeNegocioError(`Ano de fabricação deve estar entre ${ANO_FABRICACAO_MINIMO} e ${anoAtual}.`);
    }
  },

  exigirPesoPositivo(peso: number): void {
    if (peso <= 0) throw new RegraDeNegocioError('O peso do equipamento deve ser maior que zero.');
  },

  /** 🔒 REGRA 1 - Trava de Desmonte: só segue para desmonte quem passou por EM_TRIAGEM. */
  exigirTriagemAntesDoDesmonte(statusAtual: StatusRastreamento, novoStatus: StatusRastreamento): void {
    const ehStatusDesmonte =
      novoStatus === StatusRastreamento.EM_DESMONTE || novoStatus === StatusRastreamento.AGUARDANDO_DESMONTE;

    if (ehStatusDesmonte && statusAtual !== StatusRastreamento.EM_TRIAGEM) {
      throw new RegraDeNegocioError(
        'Regra Violada: O equipamento deve passar por triagem completa (EM_TRIAGEM) antes de ser enviado para desmonte.'
      );
    }
  },

  /** 🔒 REGRA 2 - Rebaixar 2 ou mais categorias exige justificativa. */
  exigirJustificativaParaRebaixamento(
    estadoAtual: EstadoFisico,
    novoEstado: EstadoFisico,
    justificativa?: string
  ): void {
    const rebaixamento = HIERARQUIA_ESTADO_FISICO[estadoAtual] - HIERARQUIA_ESTADO_FISICO[novoEstado];

    if (rebaixamento >= REBAIXAMENTO_QUE_EXIGE_JUSTIFICATIVA && (!justificativa || justificativa.trim().length === 0)) {
      throw new RegraDeNegocioError(
        'Regra Violada: É obrigatória a justificativa para rebaixamento do estado físico em duas ou mais categorias.'
      );
    }
  },

  /** 🔒 Concorrência otimista: a versão informada deve ser a versão atual do registro. */
  exigirVersaoAtual(versaoAtual: number, versaoInformada: number, mensagem: string): void {
    if (versaoAtual !== versaoInformada) throw new ConflictError(mensagem);
  },

  exigirIdentificador(identificador: string): void {
    if (!identificador) {
      throw new RegraDeNegocioError('O identificador (ID ou Código de Barras) é obrigatório.');
    }
  },
};
