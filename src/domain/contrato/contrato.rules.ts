import { ConflictError, RegraDeNegocioError } from '../../errors/app-error.js';
import type { Contrato } from '../../repositories/entities.js';

export const ContratoRules = {
  exigirDatasValidas(dataAssinatura: Date, dataVencimento: Date): void {
    if (isNaN(dataAssinatura.getTime()) || isNaN(dataVencimento.getTime())) {
      throw new RegraDeNegocioError('Datas de assinatura e vencimento devem ser válidas.');
    }
    if (dataVencimento.getTime() <= dataAssinatura.getTime()) {
      throw new RegraDeNegocioError('A data de vencimento deve ser posterior à data de assinatura.');
    }
  },

  exigirValorMensalValido(valorMensal: number): void {
    if (typeof valorMensal !== 'number' || isNaN(valorMensal) || valorMensal <= 0) {
      throw new RegraDeNegocioError('O valor mensal do contrato deve ser maior que zero.');
    }
  },

  exigirClausulasValidas(clausulas: string[]): void {
    if (!Array.isArray(clausulas) || clausulas.length === 0) {
      throw new RegraDeNegocioError('O contrato deve conter ao menos uma cláusula.');
    }
    const todasValidas = clausulas.every((c) => typeof c === 'string' && c.trim().length > 0);
    if (!todasValidas) {
      throw new RegraDeNegocioError('Todas as cláusulas do contrato devem ser preenchidas.');
    }
  },

  garantirSemContratoVigente(existente: Contrato | null): void {
    if (existente && existente.ativo) {
      throw new ConflictError('A organização já possui um contrato vigente ativo.');
    }
  },

  garantirOrganizacaoAtiva(organizacao: { ativo: boolean }): void {
    if (!organizacao.ativo) {
      throw new RegraDeNegocioError('Não é possível vincular contrato a uma organização inativa.');
    }
  },

  estaVigente(
    contrato: { ativo: boolean; dataAssinatura: Date; dataVencimento: Date },
    dataReferencia: Date = new Date()
  ): boolean {
    if (!contrato.ativo) return false;
    const ref = dataReferencia.getTime();
    return ref >= contrato.dataAssinatura.getTime() && ref <= contrato.dataVencimento.getTime();
  },

  validarRenovacao(contrato: Contrato, novoVencimento: Date): void {
    if (!contrato.ativo) {
      throw new RegraDeNegocioError('Não é possível renovar um contrato encerrado ou inativo.');
    }
    if (isNaN(novoVencimento.getTime())) {
      throw new RegraDeNegocioError('A nova data de vencimento deve ser válida.');
    }
    if (novoVencimento.getTime() <= contrato.dataVencimento.getTime()) {
      throw new RegraDeNegocioError('A nova data de vencimento deve ser estritamente posterior à data de vencimento atual.');
    }
  },
};
