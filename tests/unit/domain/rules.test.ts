import { describe, expect, it } from 'vitest';
import { PapelUsuario, StatusLote, StatusRastreamento } from '../../../src/domain/shared/enums.js';
import { LoteRules } from '../../../src/domain/lote/lote.rules.js';
import { OrganizacaoRules } from '../../../src/domain/organizacao/organizacao.rules.js';
import { UsuarioRules } from '../../../src/domain/usuario/usuario.rules.js';
import { EquipamentoRules } from '../../../src/domain/equipamento/equipamento.rules.js';
import { ConflictError, ForbiddenError, RegraDeNegocioError } from '../../../src/errors/app-error.js';

const agora = new Date('2026-10-28T12:00:00Z');

describe('LoteRules', () => {
  it('aceita data de entrada dentro da janela', () => {
    expect(() => LoteRules.exigirDataEntradaValida(new Date('2026-10-20T00:00:00Z'), agora)).not.toThrow();
  });

  it('data futura -> RegraDeNegocioError com prefixo "Regra Violada"', () => {
    const acao = () => LoteRules.exigirDataEntradaValida(new Date('2026-11-30T00:00:00Z'), agora);
    expect(acao).toThrow(RegraDeNegocioError);
    expect(acao).toThrow(/^Regra Violada: .*futura/);
  });

  it('data anterior a 90 dias -> RegraDeNegocioError', () => {
    expect(() => LoteRules.exigirDataEntradaValida(new Date('2026-01-01T00:00:00Z'), agora)).toThrow(/90 dias/);
  });

  it('nota fiscal repetida -> ConflictError', () => {
    expect(() => LoteRules.garantirNotaFiscalInedita('NF-1', { id: 'x' })).toThrow(ConflictError);
    expect(() => LoteRules.garantirNotaFiscalInedita('NF-1', null)).not.toThrow();
  });

  it('somente lote RECEBIDO inicia a triagem', () => {
    expect(LoteRules.deveIniciarTriagem({ statusProcessamento: StatusLote.RECEBIDO })).toBe(true);
    expect(LoteRules.deveIniciarTriagem({ statusProcessamento: StatusLote.EM_TRIAGEM })).toBe(false);
  });

  describe('máquina de estados do Lote (TASK-10 / N3)', () => {
    it('permite o fluxo linear: RECEBIDO -> EM_TRIAGEM -> TRIAGEM_CONCLUIDA -> ENCAMINHADO -> FINALIZADO', () => {
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.RECEBIDO, StatusLote.EM_TRIAGEM)).not.toThrow();
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.EM_TRIAGEM, StatusLote.TRIAGEM_CONCLUIDA)).not.toThrow();
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.TRIAGEM_CONCLUIDA, StatusLote.ENCAMINHADO)).not.toThrow();
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.ENCAMINHADO, StatusLote.FINALIZADO)).not.toThrow();
    });

    it('bloqueia saltos e retrocessos inválidos com RegraDeNegocioError', () => {
      // Saltos
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.RECEBIDO, StatusLote.TRIAGEM_CONCLUIDA)).toThrow(RegraDeNegocioError);
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.RECEBIDO, StatusLote.FINALIZADO)).toThrow(RegraDeNegocioError);
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.EM_TRIAGEM, StatusLote.FINALIZADO)).toThrow(RegraDeNegocioError);

      // Retrocessos
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.FINALIZADO, StatusLote.ENCAMINHADO)).toThrow(RegraDeNegocioError);
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.ENCAMINHADO, StatusLote.TRIAGEM_CONCLUIDA)).toThrow(RegraDeNegocioError);
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.TRIAGEM_CONCLUIDA, StatusLote.EM_TRIAGEM)).toThrow(RegraDeNegocioError);

      // Mesmo status
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.RECEBIDO, StatusLote.RECEBIDO)).toThrow(RegraDeNegocioError);
      expect(() => LoteRules.exigirTransicaoValida(StatusLote.FINALIZADO, StatusLote.FINALIZADO)).toThrow(RegraDeNegocioError);
    });

    it('exigirCondicoesParaTriagemConcluida: exige ao menos 1 equipamento e nenhum AGUARDANDO_TRIAGEM', () => {
      // 0 equipamentos -> erro
      expect(() => LoteRules.exigirCondicoesParaTriagemConcluida([])).toThrow(/ao menos um equipamento/);

      // Com equipamento AGUARDANDO_TRIAGEM -> erro
      expect(() =>
        LoteRules.exigirCondicoesParaTriagemConcluida([
          { statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM },
        ])
      ).toThrow(/nenhum equipamento permaneça com status AGUARDANDO_TRIAGEM/);

      // Válido (equipamentos triados em desmonte, peças reaproveitadas, etc.)
      expect(() =>
        LoteRules.exigirCondicoesParaTriagemConcluida([
          { statusRastreamento: StatusRastreamento.EM_TRIAGEM },
          { statusRastreamento: StatusRastreamento.PECAS_REAPROVEITADAS },
        ])
      ).not.toThrow();
    });

    it('exigirLoteAbertoParaEquipamentos: permite apenas RECEBIDO e EM_TRIAGEM', () => {
      expect(() => LoteRules.exigirLoteAbertoParaEquipamentos({ statusProcessamento: StatusLote.RECEBIDO })).not.toThrow();
      expect(() => LoteRules.exigirLoteAbertoParaEquipamentos({ statusProcessamento: StatusLote.EM_TRIAGEM })).not.toThrow();

      expect(() => LoteRules.exigirLoteAbertoParaEquipamentos({ statusProcessamento: StatusLote.TRIAGEM_CONCLUIDA })).toThrow(RegraDeNegocioError);
      expect(() => LoteRules.exigirLoteAbertoParaEquipamentos({ statusProcessamento: StatusLote.ENCAMINHADO })).toThrow(RegraDeNegocioError);
      expect(() => LoteRules.exigirLoteAbertoParaEquipamentos({ statusProcessamento: StatusLote.FINALIZADO })).toThrow(RegraDeNegocioError);
    });

    it('exigirPodeEditar: permite edição enquanto não finalizado, bloqueia FINALIZADO', () => {
      expect(() => LoteRules.exigirPodeEditar({ statusProcessamento: StatusLote.RECEBIDO })).not.toThrow();
      expect(() => LoteRules.exigirPodeEditar({ statusProcessamento: StatusLote.EM_TRIAGEM })).not.toThrow();
      expect(() => LoteRules.exigirPodeEditar({ statusProcessamento: StatusLote.TRIAGEM_CONCLUIDA })).not.toThrow();
      expect(() => LoteRules.exigirPodeEditar({ statusProcessamento: StatusLote.ENCAMINHADO })).not.toThrow();
      expect(() => LoteRules.exigirPodeEditar({ statusProcessamento: StatusLote.FINALIZADO })).toThrow(RegraDeNegocioError);
    });

    it('exigirPodeExcluir: apenas RECEBIDO e com 0 equipamentos pode ser excluído', () => {
      expect(() => LoteRules.exigirPodeExcluir({ statusProcessamento: StatusLote.RECEBIDO }, 0)).not.toThrow();
      expect(() => LoteRules.exigirPodeExcluir({ statusProcessamento: StatusLote.RECEBIDO }, 1)).toThrow(/equipamentos vinculados/);
      expect(() => LoteRules.exigirPodeExcluir({ statusProcessamento: StatusLote.EM_TRIAGEM }, 0)).toThrow(/Apenas lotes 'RECEBIDO'/);
      expect(() => LoteRules.exigirPodeExcluir({ statusProcessamento: StatusLote.FINALIZADO }, 0)).toThrow(RegraDeNegocioError);
    });
  });
});

describe('OrganizacaoRules', () => {
  it('CNPJ inválido -> RegraDeNegocioError citando o CNPJ informado', () => {
    expect(() => OrganizacaoRules.exigirCnpjValido('11.222.333/0001-82')).toThrow(RegraDeNegocioError);
    expect(() => OrganizacaoRules.exigirCnpjValido('11.222.333/0001-82')).toThrow(/11\.222\.333\/0001-82/);
    expect(() => OrganizacaoRules.exigirCnpjValido('11.222.333/0001-81')).not.toThrow();
  });

  it('e-mail inválido -> RegraDeNegocioError', () => {
    expect(() => OrganizacaoRules.exigirEmailValido('nao-e-email')).toThrow(RegraDeNegocioError);
  });

  it('CNPJ já cadastrado -> ConflictError', () => {
    expect(() => OrganizacaoRules.garantirCnpjDisponivel('11222333000181', { id: '1' })).toThrow(ConflictError);
    expect(() => OrganizacaoRules.garantirCnpjDisponivel('11222333000181', null)).not.toThrow();
  });

  it('exigirOrganizacaoAtiva e exigirPodeDesativar validam status ativo', () => {
    expect(() => OrganizacaoRules.exigirOrganizacaoAtiva({ ativo: true })).not.toThrow();
    expect(() => OrganizacaoRules.exigirOrganizacaoAtiva({ ativo: false }, 'receber lotes')).toThrow(/Organização inativa não pode receber lotes/);

    expect(() => OrganizacaoRules.exigirPodeDesativar({ ativo: true })).not.toThrow();
    expect(() => OrganizacaoRules.exigirPodeDesativar({ ativo: false })).toThrow(/já se encontra inativa/);
  });
});

describe('EquipamentoRules - Ciclo de Vida e CRUD (TASK-12 / N5)', () => {
  it('exigirPodeEditar: permite apenas se lote aberto (RECEBIDO ou EM_TRIAGEM)', () => {
    expect(() => EquipamentoRules.exigirPodeEditar({ statusProcessamento: StatusLote.RECEBIDO })).not.toThrow();
    expect(() => EquipamentoRules.exigirPodeEditar({ statusProcessamento: StatusLote.EM_TRIAGEM })).not.toThrow();
    expect(() => EquipamentoRules.exigirPodeEditar({ statusProcessamento: StatusLote.TRIAGEM_CONCLUIDA })).toThrow(RegraDeNegocioError);
  });

  it('exigirPodeExcluir: permite apenas AGUARDANDO_TRIAGEM, 0 movimentações e lote aberto', () => {
    const loteAberto = { statusProcessamento: StatusLote.EM_TRIAGEM };
    const loteFechado = { statusProcessamento: StatusLote.TRIAGEM_CONCLUIDA };

    // Válido
    expect(() =>
      EquipamentoRules.exigirPodeExcluir({ statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM }, 0, loteAberto)
    ).not.toThrow();

    // Status de rastreamento avançado
    expect(() =>
      EquipamentoRules.exigirPodeExcluir({ statusRastreamento: StatusRastreamento.EM_TRIAGEM }, 0, loteAberto)
    ).toThrow(/Apenas equipamentos 'AGUARDANDO_TRIAGEM'/);

    // Com movimentações
    expect(() =>
      EquipamentoRules.exigirPodeExcluir({ statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM }, 1, loteAberto)
    ).toThrow(/histórico de movimentações/);

    // Lote fechado
    expect(() =>
      EquipamentoRules.exigirPodeExcluir({ statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM }, 0, loteFechado)
    ).toThrow(RegraDeNegocioError);
  });
});

describe('UsuarioRules', () => {
  const admin = { id: 'a', papel: PapelUsuario.ADMINISTRADOR };
  const operador = { id: 'o', papel: PapelUsuario.OPERADOR_CADASTRO };

  it('autorizarEdicao: admin edita qualquer um; demais só a si mesmos', () => {
    expect(UsuarioRules.autorizarEdicao(admin, 'outro')).toEqual({ ehAdmin: true, ehProprioUsuario: false });
    expect(UsuarioRules.autorizarEdicao(operador, 'o')).toEqual({ ehAdmin: false, ehProprioUsuario: true });
    expect(() => UsuarioRules.autorizarEdicao(operador, 'outro')).toThrow(ForbiddenError);
  });

  it('apenas admin altera nome de usuário e papel', () => {
    expect(() => UsuarioRules.exigirAdminParaAlterarNomeDeUsuario(false)).toThrow(ForbiddenError);
    expect(() => UsuarioRules.exigirAdminParaAlterarPapel(false)).toThrow(ForbiddenError);
    expect(() => UsuarioRules.exigirAdminParaAlterarNomeDeUsuario(true)).not.toThrow();
    expect(() => UsuarioRules.exigirAdminParaAlterarPapel(true)).not.toThrow();
  });

  it('ehRebaixamentoDeAdministrador', () => {
    expect(UsuarioRules.ehRebaixamentoDeAdministrador(admin, PapelUsuario.AUDITOR)).toBe(true);
    expect(UsuarioRules.ehRebaixamentoDeAdministrador(admin, PapelUsuario.ADMINISTRADOR)).toBe(false);
    expect(UsuarioRules.ehRebaixamentoDeAdministrador(operador, PapelUsuario.ADMINISTRADOR)).toBe(false);
  });

  it('protegerUltimoAdministrador bloqueia com 1 (ou 0) admin e libera com 2+', () => {
    expect(() => UsuarioRules.protegerUltimoAdministrador({ usuario: 'root' }, 1, 'remover o usuário')).toThrow(/único administrador/);
    expect(() => UsuarioRules.protegerUltimoAdministrador({ usuario: 'root' }, 0, 'remover o usuário')).toThrow(RegraDeNegocioError);
    expect(() => UsuarioRules.protegerUltimoAdministrador({ usuario: 'root' }, 2, 'remover o usuário')).not.toThrow();
  });

  it('exigirAlgumaAlteracao', () => {
    expect(() => UsuarioRules.exigirAlgumaAlteracao({})).toThrow(RegraDeNegocioError);
    expect(() => UsuarioRules.exigirAlgumaAlteracao({ papel: 'AUDITOR' })).not.toThrow();
  });

  it('senha e papel inválidos -> RegraDeNegocioError; usuário/nome duplicado -> ConflictError', () => {
    expect(() => UsuarioRules.exigirSenhaValida('fraca')).toThrow(RegraDeNegocioError);
    expect(() => UsuarioRules.exigirPapelValido('ROOT')).toThrow(RegraDeNegocioError);
    expect(() => UsuarioRules.garantirUsuarioInedito('x', {})).toThrow(ConflictError);
    expect(() => UsuarioRules.garantirNovoNomeDisponivel('x', {})).toThrow(ConflictError);
  });

  it('garantirNovaSenhaDiferente bloqueia senha igual à atual', () => {
    expect(() => UsuarioRules.garantirNovaSenhaDiferente('MesmaSenha#123', 'MesmaSenha#123')).toThrow(RegraDeNegocioError);
    expect(() => UsuarioRules.garantirNovaSenhaDiferente('SenhaAntiga#123', 'NovaSenha#123')).not.toThrow();
  });
});
