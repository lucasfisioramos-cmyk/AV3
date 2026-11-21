import type { EstadoFisico, TipoEquipamento } from '../shared/enums.js';

export interface LoteEficienciaInput {
  id: string;
  dataEntrada: Date;
  dataConclusao: Date;
  responsaveis?: string[];
}

export interface GargaloPeriodoItem {
  periodo: string; // 'YYYY-MM'
  totalLotes: number;
  tempoMedioHoras: number;
  medianaHoras: number;
  desvioPadraoHoras: number;
}

export interface GargaloOperadorItem {
  responsavel: string;
  totalLotes: number;
  tempoMedioHoras: number;
}

export interface EficienciaOperacionalResult {
  totalAnalisado: number;
  tempoMedioHoras: number;
  medianaHoras: number;
  desvioPadraoHoras: number;
  gargalosPorPeriodo: GargaloPeriodoItem[];
  gargalosPorOperador: GargaloOperadorItem[];
  calculadoEm: Date;
}

export interface EquipamentoRentabilidadeInput {
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  estadoFisico: EstadoFisico;
  pesoQuilogramas: number;
}

export interface RentabilidadeItem {
  estadoFisico: EstadoFisico;
  marca: string;
  modelo: string;
  quantidade: number;
  pesoTotalKg: number;
  valorTotalEstimado: number;
  valorMedioEstimado: number;
  medianaValorEstimado: number;
  desvioPadraoValorEstimado: number;
}

export interface RentabilidadeAnaliseResult {
  totalAnalisado: number;
  valorTotalGeral: number;
  valorMedioGeral: number;
  itens: RentabilidadeItem[];
  calculadoEm: Date;
}

export interface AmostraRulInput {
  tipo?: TipoEquipamento;
  marca?: string;
  modelo?: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisico;
  dataFabricacao?: Date;
}

export interface RulRegressionOutput {
  totalAmostras: number;
  slope: number;
  intercept: number;
  idadeAtualMediaDias: number;
  indiceSaudeMedioAtual: number;
  indiceSaudeProjetadoAtual: number;
  estimatedDaysLeft: number;
  predictedEndDate: Date;
}

export interface RulPredictionResult extends RulRegressionOutput {
  id?: string;
  tipoEquipamento: TipoEquipamento;
  marca: string;
  modelo: string;
  createdAt?: Date;
}
