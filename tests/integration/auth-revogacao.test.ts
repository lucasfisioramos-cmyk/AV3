import { afterAll, describe, expect, it } from 'vitest';
import { autenticado, fecharApp, obterApp, tokenPara } from '../helpers/app.js';
import { db } from '../helpers/fakes.js';
import { AuthService } from '../../src/domain/auth/auth.service.js';

afterAll(fecharApp);

describe('Revogação de JWT via PostgreSQL (TASK-08 / S1)', () => {
  it('POST /api/v1/auth/logout: revoga o jti do token atual e retorna 200 no envelope padrão', async () => {
    const usuario = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    const app = await obterApp();
    const token = await tokenPara(usuario);

    // 1. Verifica que o token funciona em uma rota protegida
    const antes = await app.inject({
      method: 'GET',
      url: '/api/v1/organizacoes',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(antes.statusCode).toBe(200);

    // 2. Executa logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json()).toMatchObject({
      data: null,
      message: 'Logout realizado com sucesso.',
    });

    // 3. Tenta acessar rota protegida com o mesmo token -> 401
    const depois = await app.inject({
      method: 'GET',
      url: '/api/v1/organizacoes',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(depois.statusCode).toBe(401);
  });

  it('POST /api/v1/auth/logout: 401 quando não autenticado', async () => {
    const app = await obterApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
    });
    expect(res.statusCode).toBe(401);
  });

  it('Troca de própria senha (PATCH /api/v1/usuarios/me/senha) revoga a sessão atual e tokens anteriores', async () => {
    const app = await obterApp();
    const usuario = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    const tokenAntigo = await tokenPara(usuario);

    const resTroca = await app.inject({
      method: 'PATCH',
      url: '/api/v1/usuarios/me/senha',
      headers: { authorization: `Bearer ${tokenAntigo}` },
      payload: {
        senhaAtual: 'Senha#Forte1',
        novaSenha: 'NovaSenha#Forte2',
      },
    });
    expect(resTroca.statusCode).toBe(200);

    // O token antigo deve estar revogado
    const resAcesso = await app.inject({
      method: 'GET',
      url: '/api/v1/organizacoes',
      headers: { authorization: `Bearer ${tokenAntigo}` },
    });
    expect(resAcesso.statusCode).toBe(401);
  });

  it('Alteração de papel por administrador invalida tokens anteriores do usuário', async () => {
    const app = await obterApp();
    const admin = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    const operador = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    const tokenOperador = await tokenPara(operador);

    // Confirma que funcionava
    const resAntes = await app.inject({
      method: 'GET',
      url: '/api/v1/organizacoes',
      headers: { authorization: `Bearer ${tokenOperador}` },
    });
    expect(resAntes.statusCode).toBe(200);

    // Simula passagem de tempo de 1 segundo para garantir diferença no iat vs tokensValidosApos
    await new Promise((resolve) => setTimeout(resolve, 1050));

    // Admin altera o papel do operador para AUDITOR
    const resEdicao = await app.inject({
      method: 'PUT',
      url: `/api/v1/usuarios/${operador.id}`,
      headers: await autenticado(admin),
      payload: { papel: 'AUDITOR' },
    });
    expect(resEdicao.statusCode).toBe(200);

    // Token anterior do operador agora deve ser rejeitado com 401
    const resDepois = await app.inject({
      method: 'GET',
      url: '/api/v1/organizacoes',
      headers: { authorization: `Bearer ${tokenOperador}` },
    });
    expect(resDepois.statusCode).toBe(401);
  });

  it('Exclusão de usuário invalida tokens ativos imediatamente', async () => {
    const app = await obterApp();
    const admin = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    const operador = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    const tokenOperador = await tokenPara(operador);

    const resDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/usuarios/${operador.id}`,
      headers: await autenticado(admin),
    });
    expect(resDelete.statusCode).toBe(200);

    // Token do usuário excluído agora deve falhar com 401
    const resAcesso = await app.inject({
      method: 'GET',
      url: '/api/v1/organizacoes',
      headers: { authorization: `Bearer ${tokenOperador}` },
    });
    expect(resAcesso.statusCode).toBe(401);
  });

  it('Limpeza de tokens expirados remove apenas registros vencidos', async () => {
    const agora = new Date();
    const expirado = new Date(agora.getTime() - 10000);
    const valido = new Date(agora.getTime() + 60000);

    await AuthService.revogarToken({ jti: 'token-expirado-1', expiresAt: expirado, motivo: 'LOGOUT' });
    await AuthService.revogarToken({ jti: 'token-valido-1', expiresAt: valido, motivo: 'LOGOUT' });

    const totalLimpos = await AuthService.limparTokensExpirados(agora);
    expect(totalLimpos).toBe(1);

    expect(await db.tokenRevogadoRepository.isRevogado('token-expirado-1')).toBe(false);
    expect(await db.tokenRevogadoRepository.isRevogado('token-valido-1')).toBe(true);
  });
});
