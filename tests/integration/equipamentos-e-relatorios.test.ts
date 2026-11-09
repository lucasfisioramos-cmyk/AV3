import { afterAll, describe, expect, it } from 'vitest';
import { autenticado, fecharApp, obterApp } from '../helpers/app.js';
import { db } from '../helpers/fakes.js';

afterAll(fecharApp);

async function chamar(metodo: 'GET' | 'POST' | 'PATCH', url: string, quem: Awaited<ReturnType<typeof db.semear.usuario>>, corpo?: object) {
  return (await obterApp()).inject({ method: metodo, url, headers: await autenticado(quem), payload: corpo });
}

describe('equipamentos (HTTP)', () => {
  const corpo = (loteId: string, extra = {}) => ({ loteId, tipo: 'NOTEBOOK', marca: 'Dell', modelo: 'X', anoFabricacao: 2020, estadoFisico: 'BOM_ESTADO', pesoQuilogramas: 2, ...extra });

  it('201 + lote passa a EM_TRIAGEM; 400 para ano futuro; 404 para lote inexistente', async () => {
    const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    const lote = await db.semear.lote((await db.semear.organizacao()).id);
    const ok = await chamar('POST', '/api/v1/equipamentos', op, corpo(lote.id));
    expect(ok.statusCode).toBe(201);
    expect(ok.json().data.codigoBarrasInterno).toMatch(/^GC-.{4}-NOT-001$/);
    expect(db.lotes.get(lote.id)?.statusProcessamento).toBe('EM_TRIAGEM');
    expect((await chamar('POST', '/api/v1/equipamentos', op, corpo(lote.id, { anoFabricacao: 2999 }))).statusCode).toBe(400);
    expect((await chamar('POST', '/api/v1/equipamentos', op, corpo('00000000-0000-4000-8000-000000000000'))).statusCode).toBe(404);
  });

  it('trava de desmonte (400), conflito de versão (409) e sucesso na movimentação', async () => {
    const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    const lote = await db.semear.lote((await db.semear.organizacao()).id);
    const eq = await db.semear.equipamento(lote.id);
    const url = `/api/v1/equipamentos/${eq.id}/movimentar`;
    const mov = { origem: 'Recebimento', destino: 'Triagem', responsavel: 'Ana', version: eq.version };

    const bloqueado = await chamar('PATCH', url, op, { ...mov, novoStatus: 'EM_DESMONTE' });
    expect(bloqueado.statusCode).toBe(400);
    expect(bloqueado.json().message).toMatch(/Regra Violada/);
    expect((await chamar('PATCH', url, op, { ...mov, novoStatus: 'EM_TRIAGEM', version: 7 })).statusCode).toBe(409);
    expect((await chamar('PATCH', url, op, { ...mov, novoStatus: 'EM_TRIAGEM' })).statusCode).toBe(200);
  });

  it('rebaixamento de 2+ categorias exige justificativa (400) e funciona com ela (200)', async () => {
    const op = await db.semear.usuario({ papel: 'GESTOR_ALMOXARIFADO' });
    const lote = await db.semear.lote((await db.semear.organizacao()).id);
    const eq = await db.semear.equipamento(lote.id, { estadoFisico: 'NOVO' });
    const url = `/api/v1/equipamentos/${eq.id}/estado-fisico`;
    expect((await chamar('PATCH', url, op, { novoEstado: 'USADO_MODERADO', version: eq.version })).statusCode).toBe(400);
    expect((await chamar('PATCH', url, op, { novoEstado: 'USADO_MODERADO', justificativa: 'Riscos profundos', version: eq.version })).statusCode).toBe(200);
  });

  it('rastreamento por código de barras (qualquer perfil autenticado)', async () => {
    const aud = await db.semear.usuario({ papel: 'AUDITOR' });
    const lote = await db.semear.lote((await db.semear.organizacao()).id);
    const eq = await db.semear.equipamento(lote.id);
    const res = await chamar('GET', `/api/v1/equipamentos/rastrear/${eq.codigoBarrasInterno}`, aud);
    expect(res.statusCode).toBe(200);
    expect((await chamar('GET', '/api/v1/equipamentos/rastrear/inexistente', aud)).statusCode).toBe(404);
  });
});

describe('relatórios (HTTP)', () => {
  it('dashboard e relatório por organização para perfis autorizados; 404 para organização inexistente', async () => {
    const aud = await db.semear.usuario({ papel: 'AUDITOR' });
    const org = await db.semear.organizacao();
    expect((await chamar('GET', '/api/v1/relatorios/status', aud)).statusCode).toBe(200);
    const ok = await chamar('GET', `/api/v1/relatorios/organizacao/${org.id}`, aud);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().data.organizacao).toMatchObject({ id: org.id, cnpj: '11222333000181' });
    expect((await chamar('GET', '/api/v1/relatorios/organizacao/00000000-0000-4000-8000-000000000000', aud)).statusCode).toBe(404);
  });
});
