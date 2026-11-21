import { afterAll, describe, expect, it } from 'vitest';
import {
  EstadoFisico,
  StatusLote,
  StatusRastreamento,
  TipoEquipamento,
} from '../../src/domain/shared/enums.js';
import { autenticado, fecharApp, obterApp } from '../helpers/app.js';
import { db } from '../helpers/fakes.js';

afterAll(fecharApp);

describe('API Pública B2B, Gestão de API Keys, Rate Limit por Parceiro e OpenAPI (SPEC-003)', () => {
  it('Gestão Interna (/api/v1/internal/api-keys): retorna rawKey apenas no POST (201), nunca no GET (200), e restringe a ADMINISTRADOR', async () => {
    const app = await obterApp();
    const admin = await db.semear.usuario({ usuario: 'admin_keys', papel: 'ADMINISTRADOR' });
    const operador = await db.semear.usuario({
      usuario: 'op_keys',
      papel: 'OPERADOR_CADASTRO',
    });

    // Não-administrador recebe 403
    const resProibido = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/api-keys',
      headers: await autenticado(operador),
      payload: {
        partnerName: 'Parceiro Tentativa',
        scopes: ['read:traceability'],
      },
    });
    expect(resProibido.statusCode).toBe(403);

    // Administrador cria chave (201) e recebe rawKey
    const resCriacao = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/api-keys',
      headers: await autenticado(admin),
      payload: {
        partnerName: 'GreenPartner B2B',
        scopes: ['read:traceability', 'read:analytics'],
        rateLimit: 50,
      },
    });
    expect(resCriacao.statusCode).toBe(201);
    const criada = resCriacao.json().data;
    expect(criada.rawKey).toMatch(/^gc_live_[0-9a-f]{48}$/);
    expect(criada.keyPrefix).toBe(criada.rawKey.slice(0, 12));
    expect(criada).not.toHaveProperty('keyHash');

    // Listagem (GET /api/v1/internal/api-keys) NUNCA expõe rawKey nem keyHash
    const resLista = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/api-keys',
      headers: await autenticado(admin),
    });
    expect(resLista.statusCode).toBe(200);
    const lista = resLista.json().data;
    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe(criada.id);
    expect(lista[0]).not.toHaveProperty('rawKey');
    expect(lista[0]).not.toHaveProperty('keyHash');
  });

  it('Autenticação e Escopos (/api/v1/public/*): 401 sem chave ou revogada, 403 sem escopo da rota', async () => {
    const app = await obterApp();
    const admin = await db.semear.usuario({ papel: 'ADMINISTRADOR' });

    // Sem header x-api-key -> 401
    const resSemChave = await app.inject({
      method: 'GET',
      url: '/api/v1/public/analytics/eficiencia',
    });
    expect(resSemChave.statusCode).toBe(401);

    // Cria chave apenas com escopo read:traceability
    const resCriacao = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/api-keys',
      headers: await autenticado(admin),
      payload: {
        partnerName: 'Parceiro Traceability Only',
        scopes: ['read:traceability'],
      },
    });
    const { id, rawKey } = resCriacao.json().data;

    // Acesso a rota que exige read:analytics -> 403 Forbidden
    const resSemEscopo = await app.inject({
      method: 'GET',
      url: '/api/v1/public/analytics/eficiencia',
      headers: { 'x-api-key': rawKey },
    });
    expect(resSemEscopo.statusCode).toBe(403);

    // Revoga a chave via DELETE /api/v1/internal/api-keys/:id
    const resRevogacao = await app.inject({
      method: 'DELETE',
      url: `/api/v1/internal/api-keys/${id}`,
      headers: await autenticado(admin),
    });
    expect(resRevogacao.statusCode).toBe(200);
    expect(resRevogacao.json().data.isActive).toBe(false);

    // Chave revogada agora retorna 401 mesmo na rota do seu escopo
    const resRevogada = await app.inject({
      method: 'GET',
      url: '/api/v1/public/rastreabilidade/GC-0001-NOT-001',
      headers: { 'x-api-key': rawKey },
    });
    expect(resRevogada.statusCode).toBe(401);
  });

  it('Endpoints Públicos Síncronos: 200 em rastreabilidade, eficiência, rentabilidade e RUL (404 e 400 nos casos de erro)', async () => {
    const app = await obterApp();
    const admin = await db.semear.usuario({ papel: 'ADMINISTRADOR' });

    const resKey = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/api-keys',
      headers: await autenticado(admin),
      payload: {
        partnerName: 'Parceiro Full Analytics',
        scopes: ['read:traceability', 'read:analytics'],
        rateLimit: 100,
      },
    });
    const { rawKey } = resKey.json().data;

    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id, {
      dataEntrada: new Date('2026-10-01T08:00:00.000Z'),
      statusProcessamento: StatusLote.FINALIZADO,
    });
    const eq1 = await db.semear.equipamento(lote.id, {
      tipo: TipoEquipamento.NOTEBOOK,
      marca: 'Dell',
      modelo: 'Latitude 5430',
      anoFabricacao: 2025,
      estadoFisico: EstadoFisico.NOVO,
      pesoQuilogramas: 2.2,
      statusRastreamento: StatusRastreamento.PECAS_REAPROVEITADAS,
    });
    await db.equipamentoRepository.registrarMovimentacao({
      equipamentoId: eq1.id,
      origem: 'Triagem',
      destino: 'Estoque Peças',
      responsavel: 'tecnico.lucas',
      dataHora: new Date('2026-10-01T14:00:00.000Z'),
    });

    // 1. Rastreabilidade por código de barras (200 e 404)
    const resRast = await app.inject({
      method: 'GET',
      url: `/api/v1/public/rastreabilidade/${eq1.codigoBarrasInterno}`,
      headers: { 'x-api-key': rawKey },
    });
    expect(resRast.statusCode).toBe(200);
    expect(resRast.json().data).toMatchObject({
      codigoBarras: eq1.codigoBarrasInterno,
      marca: 'Dell',
      modelo: 'Latitude 5430',
    });
    expect(resRast.json().data.historicoMovimentacoes).toHaveLength(1);

    const resRast404 = await app.inject({
      method: 'GET',
      url: '/api/v1/public/rastreabilidade/CODIGO-INEXISTENTE',
      headers: { 'x-api-key': rawKey },
    });
    expect(resRast404.statusCode).toBe(404);

    // 2. Eficiência Operacional (200)
    const resEf = await app.inject({
      method: 'GET',
      url: '/api/v1/public/analytics/eficiencia',
      headers: { 'x-api-key': rawKey },
    });
    expect(resEf.statusCode).toBe(200);
    expect(resEf.json().data).toMatchObject({
      mediaHoras: 6,
      medianaHoras: 6,
      totalLotesAnalisados: 1,
    });

    // 3. Rentabilidade (200)
    const resRent = await app.inject({
      method: 'GET',
      url: '/api/v1/public/analytics/rentabilidade',
      headers: { 'x-api-key': rawKey },
    });
    expect(resRent.statusCode).toBe(200);
    expect(resRent.json().data).toHaveLength(1);
    expect(resRent.json().data[0]).toMatchObject({
      marca: 'Dell',
      modelo: 'Latitude 5430',
      quantidade: 1,
    });

    // 4. RUL: com apenas 1 equipamento retorna 400 (amostra insuficiente)
    const resRul400 = await app.inject({
      method: 'GET',
      url: '/api/v1/public/analytics/rul?tipoEquipamento=NOTEBOOK&marca=Dell&modelo=Latitude%205430',
      headers: { 'x-api-key': rawKey },
    });
    expect(resRul400.statusCode).toBe(400);

    // Adiciona mais 2 equipamentos mais antigos e degradados para permitir regressão OLS
    await db.semear.equipamento(lote.id, {
      tipo: TipoEquipamento.NOTEBOOK,
      marca: 'Dell',
      modelo: 'Latitude 5430',
      anoFabricacao: 2022,
      estadoFisico: EstadoFisico.USADO_MODERADO,
    });
    await db.semear.equipamento(lote.id, {
      tipo: TipoEquipamento.NOTEBOOK,
      marca: 'Dell',
      modelo: 'Latitude 5430',
      anoFabricacao: 2019,
      estadoFisico: EstadoFisico.DANIFICADO_GRAVE,
    });

    const resRul200 = await app.inject({
      method: 'GET',
      url: '/api/v1/public/analytics/rul?tipoEquipamento=NOTEBOOK&marca=Dell&modelo=Latitude%205430',
      headers: { 'x-api-key': rawKey },
    });
    expect(resRul200.statusCode).toBe(200);
    expect(resRul200.json().data).toMatchObject({
      tipoEquipamento: 'NOTEBOOK',
      marca: 'Dell',
      modelo: 'Latitude 5430',
    });
    expect(resRul200.json().data.slope).toBeLessThan(0);
    expect(resRul200.json().data.estimatedDaysLeft).toBeGreaterThanOrEqual(0);
  });

  it('Rate Limiting por Parceiro (RNF04): bloqueia requisição excedente ao rateLimit da API Key com 429 Too Many Requests', async () => {
    const app = await obterApp();
    const admin = await db.semear.usuario({ papel: 'ADMINISTRADOR' });

    const resKey = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/api-keys',
      headers: await autenticado(admin),
      payload: {
        partnerName: 'Parceiro Cota Baixa',
        scopes: ['read:analytics'],
        rateLimit: 2,
      },
    });
    const { rawKey } = resKey.json().data;

    // 2 primeiras requisições passam com 200
    for (let i = 0; i < 2; i++) {
      const ok = await app.inject({
        method: 'GET',
        url: '/api/v1/public/analytics/eficiencia',
        headers: { 'x-api-key': rawKey },
      });
      expect(ok.statusCode).toBe(200);
    }

    // 3ª requisição com a mesma API Key retorna 429 no envelope padrão de erro
    const bloqueada = await app.inject({
      method: 'GET',
      url: '/api/v1/public/analytics/eficiencia',
      headers: { 'x-api-key': rawKey },
    });
    expect(bloqueada.statusCode).toBe(429);
    expect(bloqueada.json()).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
    });
  });

  it('Swagger/OpenAPI (/docs/json): documenta securitySchemes bearerAuth e apiKeyAuth e rotas /api/v1/public/*', async () => {
    const app = await obterApp();
    const res = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.components?.securitySchemes).toMatchObject({
      bearerAuth: { type: 'http', scheme: 'bearer' },
      apiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
    });
    const paths = Object.keys(spec.paths);
    expect(paths.some((p) => p.startsWith('/api/v1/internal/api-keys'))).toBe(true);
    expect(spec.paths).toHaveProperty('/api/v1/public/rastreabilidade/{codigoBarras}');
    expect(spec.paths).toHaveProperty('/api/v1/public/analytics/eficiencia');
    expect(spec.paths).toHaveProperty('/api/v1/public/analytics/rentabilidade');
    expect(spec.paths).toHaveProperty('/api/v1/public/analytics/rul');
  });
});
