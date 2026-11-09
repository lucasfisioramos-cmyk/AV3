import { describe, expect, it } from 'vitest';
import { AuthService } from '../../../src/domain/auth/auth.service.js';
import { LoteService } from '../../../src/domain/lote/lote.service.js';
import { OrganizacaoService } from '../../../src/domain/organizacao/organizacao.service.js';
import { UsuarioService } from '../../../src/domain/usuario/usuario.service.js';
import { ConflictError, NotFoundError, RegraDeNegocioError, UnauthorizedError } from '../../../src/errors/app-error.js';
import { PasswordHasher } from '../../../src/security/hasher.js';
import { db, SENHA_TESTE } from '../../helpers/fakes.js';
import bcrypt from 'bcrypt';

describe('AuthService.autenticar', () => {
  it('retorna a identidade (sem hash) e registra o último acesso', async () => {
    const u = await db.semear.usuario({ usuario: 'maria', papel: 'AUDITOR' });
    const r = await AuthService.autenticar('maria', SENHA_TESTE);
    expect(r).toEqual({ id: u.id, usuario: 'maria', papel: 'AUDITOR' });
    expect((await db.usuarioRepository.findById(u.id))?.ultimoAcesso).toBeInstanceOf(Date);
  });

  it.each([
    ['usuário inexistente', 'fantasma', SENHA_TESTE],
    ['senha errada', 'maria', 'Errada#123x'],
  ])('%s -> UnauthorizedError com a MESMA mensagem (anti-enumeração)', async (_c, usuario, senha) => {
    await db.semear.usuario({ usuario: 'maria' });
    const erro = await AuthService.autenticar(usuario, senha).catch((e) => e);
    expect(erro).toBeInstanceOf(UnauthorizedError);
    expect(erro.message).toBe('Credenciais inválidas.');
  });

  it.each([[undefined, 'x'], ['x', undefined], ['', 'x'], ['x', '']])('credenciais vazias (%j, %j) -> erro de regra', async (u, s) => {
    await expect(AuthService.autenticar(u, s)).rejects.toBeInstanceOf(RegraDeNegocioError);
  });

  it('regrava (rehash) hashes de custo antigo após login válido', async () => {
    const antigo = await bcrypt.hash(SENHA_TESTE, 10);
    const u = await db.semear.usuario({ usuario: 'velho', hashSenha: antigo });
    await AuthService.autenticar('velho', SENHA_TESTE);
    const cred = await db.usuarioRepository.findCredencialByUsuario('velho');
    expect(cred?.hashSenha).not.toBe(antigo);
    expect(PasswordHasher.precisaRehash(cred!.hashSenha)).toBe(false);
    expect(u.id).toBe(cred?.id);
  });

  it('não altera o hash quando ele já está no custo atual', async () => {
    await db.semear.usuario({ usuario: 'novo' });
    const antes = (await db.usuarioRepository.findCredencialByUsuario('novo'))!.hashSenha;
    await AuthService.autenticar('novo', SENHA_TESTE);
    expect((await db.usuarioRepository.findCredencialByUsuario('novo'))!.hashSenha).toBe(antes);
  });
});

describe('UsuarioService', () => {
  it('cria usuário gravando apenas o hash bcrypt (nunca a senha)', async () => {
    const criado = await UsuarioService.criarUsuario({ usuario: 'joao', senhaPlana: SENHA_TESTE, papel: 'AUDITOR' as never });
    expect(criado).not.toHaveProperty('hashSenha');
    const cred = await db.usuarioRepository.findCredencialByUsuario('joao');
    expect(cred?.hashSenha).toMatch(/^\$2[aby]\$12\$/);
    expect(cred?.hashSenha).not.toContain(SENHA_TESTE);
  });

  it('rejeita nome duplicado, senha fraca e papel inválido', async () => {
    await db.semear.usuario({ usuario: 'joao' });
    await expect(UsuarioService.criarUsuario({ usuario: 'joao', senhaPlana: SENHA_TESTE, papel: 'AUDITOR' as never })).rejects.toBeInstanceOf(ConflictError);
    await expect(UsuarioService.criarUsuario({ usuario: 'x1', senhaPlana: 'fraca', papel: 'AUDITOR' as never })).rejects.toBeInstanceOf(RegraDeNegocioError);
    await expect(UsuarioService.criarUsuario({ usuario: 'x2', senhaPlana: SENHA_TESTE, papel: 'ROOT' as never })).rejects.toBeInstanceOf(RegraDeNegocioError);
  });

  describe('proteção do último administrador', () => {
    it('não rebaixa o único administrador (e usa transação serializável)', async () => {
      const admin = await db.semear.usuario({ usuario: 'root', papel: 'ADMINISTRADOR' });
      await expect(
        UsuarioService.editarUsuario({ idUsuarioAlvo: admin.id, idUsuarioExecuto: admin.id, novoPapel: 'AUDITOR' as never })
      ).rejects.toThrow(/único administrador/);
      expect(db.transacoes).toEqual([{ isolamento: 'serializavel' }]);
      expect((await db.usuarioRepository.findById(admin.id))?.papel).toBe('ADMINISTRADOR');
    });

    it('rebaixa quando existe outro administrador', async () => {
      const a = await db.semear.usuario({ usuario: 'a', papel: 'ADMINISTRADOR' });
      await db.semear.usuario({ usuario: 'b', papel: 'ADMINISTRADOR' });
      const r = await UsuarioService.editarUsuario({ idUsuarioAlvo: a.id, idUsuarioExecuto: a.id, novoPapel: 'AUDITOR' as never });
      expect(r.papel).toBe('AUDITOR');
    });

    it('não remove o único administrador; remove quando há outro', async () => {
      const a = await db.semear.usuario({ usuario: 'a', papel: 'ADMINISTRADOR' });
      await expect(UsuarioService.deletarUsuario(a.id)).rejects.toThrow(/único administrador/);
      expect(db.usuarios.has(a.id)).toBe(true);
      await db.semear.usuario({ usuario: 'b', papel: 'ADMINISTRADOR' });
      await UsuarioService.deletarUsuario(a.id);
      expect(db.usuarios.has(a.id)).toBe(false);
    });

    it('remover usuário comum não abre transação', async () => {
      const u = await db.semear.usuario({ papel: 'AUDITOR' });
      await UsuarioService.deletarUsuario(u.id);
      expect(db.transacoes).toHaveLength(0);
    });

    it('usuário inexistente -> NotFoundError', async () => {
      await expect(UsuarioService.deletarUsuario('nao-existe')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('edição', () => {
    it('não-admin não troca papel nem nome, mas troca a própria senha', async () => {
      const u = await db.semear.usuario({ usuario: 'op', papel: 'OPERADOR_CADASTRO' });
      await expect(UsuarioService.editarUsuario({ idUsuarioAlvo: u.id, idUsuarioExecuto: u.id, novoPapel: 'ADMINISTRADOR' as never })).rejects.toThrow(/perfil de acesso/);
      await expect(UsuarioService.editarUsuario({ idUsuarioAlvo: u.id, idUsuarioExecuto: u.id, novoUsuario: 'outro' })).rejects.toThrow(/nome de usuário/);
      await UsuarioService.editarUsuario({ idUsuarioAlvo: u.id, idUsuarioExecuto: u.id, novaSenha: 'Outra#Senha9' });
      expect(await AuthService.autenticar('op', 'Outra#Senha9')).toMatchObject({ usuario: 'op' });
    });

    it('não-admin não edita outro usuário', async () => {
      const a = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
      const b = await db.semear.usuario({ papel: 'AUDITOR' });
      await expect(UsuarioService.editarUsuario({ idUsuarioAlvo: b.id, idUsuarioExecuto: a.id, novaSenha: 'Outra#Senha9' })).rejects.toThrow(/Acesso negado/);
    });

    it('nova senha não pode conter o nome de usuário e sem alterações é erro', async () => {
      const u = await db.semear.usuario({ usuario: 'carlos' });
      await expect(UsuarioService.editarUsuario({ idUsuarioAlvo: u.id, idUsuarioExecuto: u.id, novaSenha: 'Carlos#2026x' })).rejects.toThrow(/nome de usuário/);
      await expect(UsuarioService.editarUsuario({ idUsuarioAlvo: u.id, idUsuarioExecuto: u.id })).rejects.toThrow(/Nenhum dado/);
    });

    it('nome já em uso -> ConflictError', async () => {
      const a = await db.semear.usuario({ usuario: 'adm', papel: 'ADMINISTRADOR' });
      await db.semear.usuario({ usuario: 'ocupado' });
      await expect(UsuarioService.editarUsuario({ idUsuarioAlvo: a.id, idUsuarioExecuto: a.id, novoUsuario: 'ocupado' })).rejects.toBeInstanceOf(ConflictError);
    });
  });
});

describe('OrganizacaoService', () => {
  const dados = { razaoSocial: 'ACME', cnpj: '11.222.333/0001-81', enderecoCompleto: 'Rua A', email: 'a@acme.com' };

  it('grava o CNPJ só com dígitos e telefone vazio quando ausente', async () => {
    const o = await OrganizacaoService.criarOrganizacao(dados);
    expect(o.cnpj).toBe('11222333000181');
    expect(o.telefone).toBe('');
  });

  it('o mesmo CNPJ com ou sem máscara é duplicado (409)', async () => {
    await OrganizacaoService.criarOrganizacao(dados);
    await expect(OrganizacaoService.criarOrganizacao({ ...dados, cnpj: '11222333000181' })).rejects.toBeInstanceOf(ConflictError);
  });

  it('CNPJ com dígito errado e e-mail inválido -> erro de regra, nada é gravado', async () => {
    await expect(OrganizacaoService.criarOrganizacao({ ...dados, cnpj: '11222333000182' })).rejects.toBeInstanceOf(RegraDeNegocioError);
    await expect(OrganizacaoService.criarOrganizacao({ ...dados, email: 'x' })).rejects.toBeInstanceOf(RegraDeNegocioError);
    expect(db.organizacoes.size).toBe(0);
  });
});

describe('LoteService.criarLote', () => {
  it('cria lote RECEBIDO com data atual por padrão', async () => {
    const o = await db.semear.organizacao();
    const l = await LoteService.criarLote({ organizacaoId: o.id, notaFiscal: 'NF-1', transportadora: 'T' });
    expect(l.statusProcessamento).toBe('RECEBIDO');
    expect(Math.abs(l.dataEntrada.getTime() - Date.now())).toBeLessThan(5000);
  });

  it('organização inexistente -> 404; data futura/antiga -> regra violada; NF duplicada -> 409', async () => {
    const o = await db.semear.organizacao();
    const base = { organizacaoId: o.id, notaFiscal: 'NF-2', transportadora: 'T' };
    await expect(LoteService.criarLote({ ...base, organizacaoId: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(LoteService.criarLote({ ...base, dataEntrada: new Date(Date.now() + 86_400_000 * 2) })).rejects.toThrow(/^Regra Violada/);
    await expect(LoteService.criarLote({ ...base, dataEntrada: new Date(Date.now() - 86_400_000 * 120) })).rejects.toThrow(/^Regra Violada/);
    await LoteService.criarLote(base);
    await expect(LoteService.criarLote(base)).rejects.toBeInstanceOf(ConflictError);
    expect(db.lotes.size).toBe(1);
  });

  it('a mesma NF é aceita em outra organização', async () => {
    const a = await db.semear.organizacao();
    const b = await db.semear.organizacao({ cnpj: '45723174000110', razaoSocial: 'B' });
    await LoteService.criarLote({ organizacaoId: a.id, notaFiscal: 'NF-9', transportadora: 'T' });
    await expect(LoteService.criarLote({ organizacaoId: b.id, notaFiscal: 'NF-9', transportadora: 'T' })).resolves.toBeDefined();
  });
});
