import { afterAll, describe, expect, it } from 'vitest';
import { autenticado, fecharApp, obterApp } from '../helpers/app.js';
import { db, SENHA_TESTE } from '../helpers/fakes.js';

afterAll(fecharApp);

async function req(metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, quem: Awaited<ReturnType<typeof db.semear.usuario>>, corpo?: object) {
  return (await obterApp()).inject({ method: metodo, url, headers: await autenticado(quem), payload: corpo });
}

describe('criação de usuário (POST /api/v1/usuarios)', () => {
  it('201: administrador cria usuário e a resposta não contém hash', async () => {
    const admin = await db.semear.usuario({ usuario: 'root', papel: 'ADMINISTRADOR' });
    const res = await req('POST', '/api/v1/usuarios', admin, { usuario: 'novo', senhaPlana: SENHA_TESTE, papel: 'AUDITOR' });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({ usuario: 'novo', papel: 'AUDITOR' });
    expect(res.body).not.toMatch(/hash|senha|\$2[aby]\$/i);
    // o novo usuário consegue entrar
    const login = await (await obterApp()).inject({ method: 'POST', url: '/api/v1/auth/login', payload: { usuario: 'novo', senha: SENHA_TESTE } });
    expect(login.statusCode).toBe(200);
  });

  it('409: nome de usuário repetido', async () => {
    const admin = await db.semear.usuario({ usuario: 'root', papel: 'ADMINISTRADOR' });
    const res = await req('POST', '/api/v1/usuarios', admin, { usuario: 'root', senhaPlana: SENHA_TESTE, papel: 'AUDITOR' });
    expect(res.statusCode).toBe(409);
  });

  it.each(['Curta1!', 'semnumero#Aa', 'admin123!', 'Root2#2026abc'])('400: senha fora da política (%s)', async (senha) => {
    const admin = await db.semear.usuario({ usuario: 'root', papel: 'ADMINISTRADOR' });
    const res = await req('POST', '/api/v1/usuarios', admin, { usuario: 'root2', senhaPlana: senha, papel: 'AUDITOR' });
    expect(res.statusCode).toBe(400);
  });

  it('400: papel inexistente ou corpo incompleto', async () => {
    const admin = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    expect((await req('POST', '/api/v1/usuarios', admin, { usuario: 'x', senhaPlana: SENHA_TESTE, papel: 'ROOT' })).statusCode).toBe(400);
    expect((await req('POST', '/api/v1/usuarios', admin, { usuario: 'x' })).statusCode).toBe(400);
  });

  it('403: quem não é administrador não cria usuário (mesmo com corpo inválido, a autorização vem antes)', async () => {
    const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    expect((await req('POST', '/api/v1/usuarios', op, { usuario: 'x', senhaPlana: SENHA_TESTE, papel: 'AUDITOR' })).statusCode).toBe(403);
    expect((await req('POST', '/api/v1/usuarios', op, {})).statusCode).toBe(403);
    expect(db.usuarios.size).toBe(1);
  });
});

describe('proteções de administrador (HTTP)', () => {
  it('400: não rebaixa o único administrador; 200 quando há outro', async () => {
    const a = await db.semear.usuario({ usuario: 'a', papel: 'ADMINISTRADOR' });
    const r1 = await req('PUT', `/api/v1/usuarios/${a.id}`, a, { papel: 'AUDITOR' });
    expect(r1.statusCode).toBe(400);
    expect(r1.json().message).toMatch(/único administrador/);
    await db.semear.usuario({ usuario: 'b', papel: 'ADMINISTRADOR' });
    expect((await req('PUT', `/api/v1/usuarios/${a.id}`, a, { papel: 'AUDITOR' })).statusCode).toBe(200);
  });

  it('400: não remove o único administrador; 2xx quando há outro', async () => {
    const a = await db.semear.usuario({ usuario: 'a', papel: 'ADMINISTRADOR' });
    expect((await req('DELETE', `/api/v1/usuarios/${a.id}`, a)).statusCode).toBe(400);
    const b = await db.semear.usuario({ usuario: 'b', papel: 'ADMINISTRADOR' });
    const ok = await req('DELETE', `/api/v1/usuarios/${b.id}`, a);
    expect(ok.statusCode).toBeLessThan(300);
    expect(db.usuarios.has(b.id)).toBe(false);
  });

  it('403: não-administrador não edita nem remove outros usuários', async () => {
    const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    const outro = await db.semear.usuario({ papel: 'AUDITOR' });
    expect((await req('PUT', `/api/v1/usuarios/${outro.id}`, op, { papel: 'ADMINISTRADOR' })).statusCode).toBe(403);
    expect((await req('DELETE', `/api/v1/usuarios/${outro.id}`, op)).statusCode).toBe(403);
    expect(db.usuarios.get(outro.id)?.papel).toBe('AUDITOR');
  });

  it('PATCH /me/senha: exige senhaAtual e novaSenha respeitando política e validação de credencial (S3)', async () => {
    const op = await db.semear.usuario({ usuario: 'op', papel: 'OPERADOR_CADASTRO' });

    // 400: senhaAtual ausente
    const resSemAtual = await req('PATCH', '/api/v1/usuarios/me/senha', op, { novaSenha: 'Nova#Senha77' });
    expect(resSemAtual.statusCode).toBe(400);

    // 400: novaSenha fraca
    const resFraca = await req('PATCH', '/api/v1/usuarios/me/senha', op, { senhaAtual: SENHA_TESTE, novaSenha: 'fraca' });
    expect(resFraca.statusCode).toBe(400);

    // 400: novaSenha igual à senhaAtual
    const resIgual = await req('PATCH', '/api/v1/usuarios/me/senha', op, { senhaAtual: SENHA_TESTE, novaSenha: SENHA_TESTE });
    expect(resIgual.statusCode).toBe(400);
    expect(resIgual.json()).toMatchObject({
      statusCode: 400,
      message: 'A nova senha deve ser diferente da senha atual.',
    });

    // 401: senhaAtual incorreta (não altera o banco)
    const resErrada = await req('PATCH', '/api/v1/usuarios/me/senha', op, { senhaAtual: 'SenhaIncorreta#123', novaSenha: 'Nova#Senha77' });
    expect(resErrada.statusCode).toBe(401);
    expect(resErrada.json()).toMatchObject({
      statusCode: 401,
      message: 'Senha atual incorreta.',
    });

    // Login com senha antiga continua funcionando após tentativa com senha errada
    const loginAindaAntiga = await (await obterApp()).inject({ method: 'POST', url: '/api/v1/auth/login', payload: { usuario: 'op', senha: SENHA_TESTE } });
    expect(loginAindaAntiga.statusCode).toBe(200);

    // Sucesso: senhaAtual correta e novaSenha válida diferente
    const resSucesso = await req('PATCH', '/api/v1/usuarios/me/senha', op, { senhaAtual: SENHA_TESTE, novaSenha: 'Nova#Senha77' });
    expect(resSucesso.statusCode).toBeLessThan(300);

    // Login com nova senha agora funciona
    const loginNova = await (await obterApp()).inject({ method: 'POST', url: '/api/v1/auth/login', payload: { usuario: 'op', senha: 'Nova#Senha77' } });
    expect(loginNova.statusCode).toBe(200);

    // Login com senha antiga agora é rejeitado
    const loginAntigaFalha = await (await obterApp()).inject({ method: 'POST', url: '/api/v1/auth/login', payload: { usuario: 'op', senha: SENHA_TESTE } });
    expect(loginAntigaFalha.statusCode).toBe(401);
  });
});
