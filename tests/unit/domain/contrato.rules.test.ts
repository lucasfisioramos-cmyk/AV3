import { describe, expect, it } from 'vitest';
import { ContratoRules } from '../../../src/domain/contrato/contrato.rules.js';
import { ConflictError, RegraDeNegocioError } from '../../../src/errors/app-error.js';
import type { Contrato } from '../../../src/repositories/entities.js';

describe('ContratoRules (Regras Puras do Domínio Contrato — TASK-09 / N4)', () => {
  const agora = new Date('2026-01-01T10:00:00.000Z');
  const futuro = new Date('2027-01-01T10:00:00.000Z');
  const passado = new Date('2025-01-01T10:00:00.000Z');

  describe('exigirDatasValidas', () => {
    it('aceita quando dataVencimento é posterior a dataAssinatura', () => {
      expect(() => ContratoRules.exigirDatasValidas(agora, futuro)).not.toThrow();
    });

    it('rejeita quando dataVencimento é igual ou anterior a dataAssinatura', () => {
      expect(() => ContratoRules.exigirDatasValidas(agora, agora)).toThrow(RegraDeNegocioError);
      expect(() => ContratoRules.exigirDatasValidas(futuro, agora)).toThrow(RegraDeNegocioError);
    });

    it('rejeita datas inválidas (NaN)', () => {
      expect(() => ContratoRules.exigirDatasValidas(new Date('invalida'), futuro)).toThrow(RegraDeNegocioError);
    });
  });

  describe('exigirValorMensalValido', () => {
    it('aceita valores maiores que zero', () => {
      expect(() => ContratoRules.exigirValorMensalValido(1500)).not.toThrow();
      expect(() => ContratoRules.exigirValorMensalValido(0.01)).not.toThrow();
    });

    it('rejeita valores menores ou iguais a zero', () => {
      expect(() => ContratoRules.exigirValorMensalValido(0)).toThrow(RegraDeNegocioError);
      expect(() => ContratoRules.exigirValorMensalValido(-100)).toThrow(RegraDeNegocioError);
    });
  });

  describe('exigirClausulasValidas', () => {
    it('aceita lista não vazia com cláusulas preenchidas', () => {
      expect(() => ContratoRules.exigirClausulasValidas(['Cláusula 1', 'Cláusula 2'])).not.toThrow();
    });

    it('rejeita lista vazia', () => {
      expect(() => ContratoRules.exigirClausulasValidas([])).toThrow(RegraDeNegocioError);
    });

    it('rejeita lista com cláusulas em branco ou vazias', () => {
      expect(() => ContratoRules.exigirClausulasValidas(['Cláusula 1', '   '])).toThrow(RegraDeNegocioError);
    });
  });

  describe('garantirSemContratoVigente', () => {
    it('não lança erro quando não há contrato ou o existente está inativo', () => {
      expect(() => ContratoRules.garantirSemContratoVigente(null)).not.toThrow();
      expect(() =>
        ContratoRules.garantirSemContratoVigente({
          id: 'c1',
          organizacaoId: 'org1',
          dataAssinatura: agora,
          dataVencimento: futuro,
          clausulas: ['Clausula'],
          valorMensal: 1000,
          renovacaoAutomatica: true,
          ativo: false,
          createdAt: agora,
          updatedAt: agora,
        })
      ).not.toThrow();
    });

    it('lança ConflictError quando já existe contrato ativo', () => {
      expect(() =>
        ContratoRules.garantirSemContratoVigente({
          id: 'c1',
          organizacaoId: 'org1',
          dataAssinatura: agora,
          dataVencimento: futuro,
          clausulas: ['Clausula'],
          valorMensal: 1000,
          renovacaoAutomatica: true,
          ativo: true,
          createdAt: agora,
          updatedAt: agora,
        })
      ).toThrow(ConflictError);
    });
  });

  describe('garantirOrganizacaoAtiva', () => {
    it('permite para organização ativa', () => {
      expect(() => ContratoRules.garantirOrganizacaoAtiva({ ativo: true })).not.toThrow();
    });

    it('rejeita para organização inativa', () => {
      expect(() => ContratoRules.garantirOrganizacaoAtiva({ ativo: false })).toThrow(RegraDeNegocioError);
    });
  });

  describe('estaVigente', () => {
    it('retorna true quando contrato é ativo e dataReferencia está dentro do intervalo', () => {
      const contrato = { ativo: true, dataAssinatura: passado, dataVencimento: futuro };
      expect(ContratoRules.estaVigente(contrato, agora)).toBe(true);
    });

    it('retorna false quando contrato está desativado (ativo = false)', () => {
      const contrato = { ativo: false, dataAssinatura: passado, dataVencimento: futuro };
      expect(ContratoRules.estaVigente(contrato, agora)).toBe(false);
    });

    it('retorna false quando dataReferencia é anterior à assinatura', () => {
      const contrato = { ativo: true, dataAssinatura: agora, dataVencimento: futuro };
      expect(ContratoRules.estaVigente(contrato, passado)).toBe(false);
    });

    it('retorna false quando dataReferencia é posterior ao vencimento', () => {
      const contrato = { ativo: true, dataAssinatura: passado, dataVencimento: agora };
      expect(ContratoRules.estaVigente(contrato, futuro)).toBe(false);
    });
  });

  describe('validarRenovacao', () => {
    const contratoAtivo: Contrato = {
      id: 'c1',
      organizacaoId: 'org1',
      dataAssinatura: passado,
      dataVencimento: agora,
      clausulas: ['Clausula'],
      valorMensal: 1000,
      renovacaoAutomatica: true,
      ativo: true,
      createdAt: passado,
      updatedAt: passado,
    };

    it('permite renovação quando nova data é posterior ao vencimento atual', () => {
      expect(() => ContratoRules.validarRenovacao(contratoAtivo, futuro)).not.toThrow();
    });

    it('rejeita renovação quando nova data é igual ou anterior ao vencimento atual', () => {
      expect(() => ContratoRules.validarRenovacao(contratoAtivo, agora)).toThrow(RegraDeNegocioError);
      expect(() => ContratoRules.validarRenovacao(contratoAtivo, passado)).toThrow(RegraDeNegocioError);
    });

    it('rejeita renovação de contrato inativo/encerrado', () => {
      expect(() => ContratoRules.validarRenovacao({ ...contratoAtivo, ativo: false }, futuro)).toThrow(
        RegraDeNegocioError
      );
    });

    it('rejeita renovação com data inválida (NaN)', () => {
      expect(() => ContratoRules.validarRenovacao(contratoAtivo, new Date('invalida'))).toThrow(
        RegraDeNegocioError
      );
    });
  });
});
