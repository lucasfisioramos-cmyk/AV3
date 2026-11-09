import { describe, expect, it } from 'vitest';
import { PapelUsuario, StatusLote } from '../../../src/domain/shared/enums.js';
import { LoteRules } from '../../../src/domain/lote/lote.rules.js';
import { OrganizacaoRules } from '../../../src/domain/organizacao/organizacao.rules.js';
import { UsuarioRules } from '../../../src/domain/usuario/usuario.rules.js';
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
});
