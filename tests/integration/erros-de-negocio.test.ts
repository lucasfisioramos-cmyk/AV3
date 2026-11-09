import { afterAll, describe, expect, it } from 'vitest';
import { autenticado, fecharApp, obterApp } from '../helpers/app.js';
import { db } from '../helpers/fakes.js';

afterAll(fecharApp);

async function chamar(metodo: 'GET' | 'POST' | 'PATCH', url: string, quem: Awaited<ReturnType<typeof db.semear.usuario>>, corpo?: object) {
  return (await obterApp()).inject({ method: metodo, url, headers: await autenticado(quem), payload: corpo });
}

const orgBody = { razaoSocial: 'ACME', cnpj: '11.222.333/0001-81', enderecoCompleto: 'Rua A, 1', email: 'a@acme.com' };

describe('organizações: regras de CNPJ', () => {
  it('201: cria e devolve o CNPJ apenas com dígitos', async () => {
    const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    const res = await chamar('POST', '/api/v1/organizacoes', op, orgBody);
    expect(res.statusCode).toBe(201);
    expect(res.json().data.cnpj).toBe('11222333000181');
  });

  it('400: CNPJ com dígito verificador errado', async () => {
    const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    const res = await chamar('POST', '/api/v1/organizacoes', op, { ...orgBody, cnpj: '11.222.333/0001-82' });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/CNPJ/);
  });

  it('409: CNPJ repetido, inclusive com máscara diferente', async () => {
    const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    await chamar('POST', '/api/v1/organizacoes', op, orgBody);
    const res = await chamar('POST', '/api/v1/organizacoes', op, { ...orgBody, cnpj: '11222333000181' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ statusCode: 409, error: 'Conflict' });
  });

  it('400 com detalhes por campo quando o corpo é inválido', async () => {
    const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
    const res = await chamar('POST', '/api/v1/organizacoes', op, { razaoSocial: '', email: 'x' });
    expect(res.statusCode).toBe(400);
    const campos = res.json().details.map((d: { campo: string }) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['razaoSocial', 'cnpj', 'email', 'enderecoCompleto']));
  });
});

describe('lotes: regras de data de entrada e nota fiscal', () => {
  it('201: lote nasce RECEBIDO; 404 para organização inexistente', async () => {
    const ga = await db.semear.usuario({ papel: 'GESTOR_ALMOXARIFADO' });
    const org = await db.semear.organizacao();
    const ok = await chamar('POST', '/api/v1/lotes', ga, { organizacaoId: org.id, notaFiscal: 'NF-1', transportadora: 'T' });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().data.statusProcessamento).toBe('RECEBIDO');
    const nf = await chamar('POST', '/api/v1/lotes', ga, { organizacaoId: '00000000-0000-4000-8000-000000000000', notaFiscal: 'NF-2', transportadora: 'T' });
    expect(nf.statusCode).toBe(404);
  });

  it('409: nota fiscal repetida na mesma organização', async () => {
    const ga = await db.semear.usuario({ papel: 'GESTOR_ALMOXARIFADO' });
    const org = await db.semear.organizacao();
    const corpo = { organizacaoId: org.id, notaFiscal: 'NF-1', transportadora: 'T' };
    await chamar('POST', '/api/v1/lotes', ga, corpo);
    expect((await chamar('POST', '/api/v1/lotes', ga, corpo)).statusCode).toBe(409);
  });

  it('400: organizacaoId que não é UUID', async () => {
    const ga = await db.semear.usuario({ papel: 'GESTOR_ALMOXARIFADO' });
    expect((await chamar('POST', '/api/v1/lotes', ga, { organizacaoId: '123', notaFiscal: 'NF', transportadora: 'T' })).statusCode).toBe(400);
  });

  it('data de entrada fora da janela: a API de criação não aceita dataEntrada; a regra é aplicada no serviço', async () => {
    // O contrato HTTP não expõe dataEntrada (lote nasce "agora"); a regra dos 90 dias é validada
    // diretamente em services.test.ts / data-entrada.test.ts. Aqui garantimos que o campo é ignorado.
    const ga = await db.semear.usuario({ papel: 'GESTOR_ALMOXARIFADO' });
    const org = await db.semear.organizacao();
    const res = await chamar('POST', '/api/v1/lotes', ga, { organizacaoId: org.id, notaFiscal: 'NF-3', transportadora: 'T', dataEntrada: '2000-01-01T00:00:00Z' });
    expect(res.statusCode).toBe(201);
    expect(Math.abs(new Date(res.json().data.dataEntrada).getTime() - Date.now())).toBeLessThan(60_000);
  });
});

describe('formato padrão dos erros', () => {
  it('404 de rota inexistente, 400 de UUID inválido e 404 de recurso inexistente', async () => {
    const adm = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    expect((await chamar('GET', '/api/v1/nao-existe', adm)).statusCode).toBe(404);
    expect((await chamar('GET', '/api/v1/lotes/abc', adm)).statusCode).toBe(400);
    const res = await chamar('GET', '/api/v1/lotes/00000000-0000-4000-8000-000000000000', adm);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ statusCode: 404, error: 'Not Found', message: 'Lote não encontrado.' });
  });

  it('erro inesperado vira 500 genérico, sem vazar a mensagem interna', async () => {
    const adm = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    const original = db.loteRepository.listarComResumo;
    db.loteRepository.listarComResumo = async () => {
      throw new Error('senha do banco: segredo123 em /var/lib/postgres');
    };
    try {
      const res = await chamar('GET', '/api/v1/lotes', adm);
      expect(res.statusCode).toBe(500);
      expect(res.body).not.toContain('segredo123');
      expect(res.json().message).toBe('Ocorreu um erro interno no servidor.');
    } finally {
      db.loteRepository.listarComResumo = original;
    }
  });
});
