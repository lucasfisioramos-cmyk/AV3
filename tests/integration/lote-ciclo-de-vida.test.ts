import { afterAll, describe, expect, it } from 'vitest';
import { autenticado, fecharApp, obterApp } from '../helpers/app.js';
import { db } from '../helpers/fakes.js';
import { PapelUsuario, StatusLote, StatusRastreamento } from '../../src/domain/shared/enums.js';

afterAll(fecharApp);

describe('Ciclo de Vida Completo do Lote (TASK-10 / N3)', () => {
  it('transição linear completa: RECEBIDO -> EM_TRIAGEM -> TRIAGEM_CONCLUIDA -> ENCAMINHADO -> FINALIZADO', async () => {
    const app = await obterApp();
    const gestor = await db.semear.usuario({ papel: PapelUsuario.GESTOR_ALMOXARIFADO });
    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id, { statusProcessamento: StatusLote.RECEBIDO });

    // 1. RECEBIDO -> EM_TRIAGEM
    const res1 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lotes/${lote.id}/status`,
      headers: await autenticado(gestor),
      payload: { status: StatusLote.EM_TRIAGEM },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().data.statusProcessamento).toBe(StatusLote.EM_TRIAGEM);

    // Cadastra 1 equipamento no lote
    const equip = await db.semear.equipamento(lote.id, {
      statusRastreamento: StatusRastreamento.EM_TRIAGEM, // equipamento já triado
    });

    // 2. EM_TRIAGEM -> TRIAGEM_CONCLUIDA
    const res2 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lotes/${lote.id}/status`,
      headers: await autenticado(gestor),
      payload: { status: StatusLote.TRIAGEM_CONCLUIDA },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().data.statusProcessamento).toBe(StatusLote.TRIAGEM_CONCLUIDA);

    // 3. TRIAGEM_CONCLUIDA -> ENCAMINHADO
    const res3 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lotes/${lote.id}/status`,
      headers: await autenticado(gestor),
      payload: { status: StatusLote.ENCAMINHADO },
    });
    expect(res3.statusCode).toBe(200);
    expect(res3.json().data.statusProcessamento).toBe(StatusLote.ENCAMINHADO);

    // 4. ENCAMINHADO -> FINALIZADO
    const res4 = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lotes/${lote.id}/status`,
      headers: await autenticado(gestor),
      payload: { status: StatusLote.FINALIZADO },
    });
    expect(res4.statusCode).toBe(200);
    expect(res4.json().data.statusProcessamento).toBe(StatusLote.FINALIZADO);
  });

  it('bloqueia saltos e retrocessos inválidos com 400 Bad Request', async () => {
    const app = await obterApp();
    const admin = await db.semear.usuario({ papel: PapelUsuario.ADMINISTRADOR });
    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id, { statusProcessamento: StatusLote.RECEBIDO });

    // Salto: RECEBIDO -> TRIAGEM_CONCLUIDA -> 400
    const resSalto = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lotes/${lote.id}/status`,
      headers: await autenticado(admin),
      payload: { status: StatusLote.TRIAGEM_CONCLUIDA },
    });
    expect(resSalto.statusCode).toBe(400);

    // Salto: RECEBIDO -> FINALIZADO -> 400
    const resSaltoFinal = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lotes/${lote.id}/status`,
      headers: await autenticado(admin),
      payload: { status: StatusLote.FINALIZADO },
    });
    expect(resSaltoFinal.statusCode).toBe(400);

    // Atualiza para ENCAMINHADO via banco em memória
    await db.loteRepository.update(lote.id, { statusProcessamento: StatusLote.ENCAMINHADO });

    // Retrocesso: ENCAMINHADO -> EM_TRIAGEM -> 400
    const resRetrocesso = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lotes/${lote.id}/status`,
      headers: await autenticado(admin),
      payload: { status: StatusLote.EM_TRIAGEM },
    });
    expect(resRetrocesso.statusCode).toBe(400);
  });

  it('exigências de TRIAGEM_CONCLUIDA: bloqueia sem equipamentos (400) ou com equipamentos AGUARDANDO_TRIAGEM (400)', async () => {
    const app = await obterApp();
    const gestor = await db.semear.usuario({ papel: PapelUsuario.GESTOR_ALMOXARIFADO });
    const org = await db.semear.organizacao();

    // 1. Lote em EM_TRIAGEM sem equipamentos
    const loteSemItens = await db.semear.lote(org.id, { statusProcessamento: StatusLote.EM_TRIAGEM });
    const resSemItens = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lotes/${loteSemItens.id}/status`,
      headers: await autenticado(gestor),
      payload: { status: StatusLote.TRIAGEM_CONCLUIDA },
    });
    expect(resSemItens.statusCode).toBe(400);
    expect(resSemItens.json().message).toMatch(/ao menos um equipamento/);

    // 2. Lote com equipamento ainda em AGUARDANDO_TRIAGEM
    const loteComAguardando = await db.semear.lote(org.id, { statusProcessamento: StatusLote.EM_TRIAGEM });
    await db.semear.equipamento(loteComAguardando.id, {
      statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM,
    });

    const resComAguardando = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lotes/${loteComAguardando.id}/status`,
      headers: await autenticado(gestor),
      payload: { status: StatusLote.TRIAGEM_CONCLUIDA },
    });
    expect(resComAguardando.statusCode).toBe(400);
    expect(resComAguardando.json().message).toMatch(/AGUARDANDO_TRIAGEM/);
  });

  it('bloqueia cadastro de novos equipamentos em lote fora de RECEBIDO / EM_TRIAGEM com 400', async () => {
    const app = await obterApp();
    const operador = await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });
    const org = await db.semear.organizacao();

    const loteFinalizado = await db.semear.lote(org.id, {
      statusProcessamento: StatusLote.TRIAGEM_CONCLUIDA,
    });

    const resCriar = await app.inject({
      method: 'POST',
      url: '/api/v1/equipamentos',
      headers: await autenticado(operador),
      payload: {
        loteId: loteFinalizado.id,
        tipo: 'NOTEBOOK',
        marca: 'Dell',
        modelo: 'Latitude',
        anoFabricacao: 2022,
        estadoFisico: 'BOM_ESTADO',
        pesoQuilogramas: 2.1,
      },
    });
    expect(resCriar.statusCode).toBe(400);
    expect(resCriar.json().message).toMatch(/Não é permitido adicionar ou alterar equipamentos/);
  });

  it('autorização (RBAC): OPERADOR_CADASTRO e AUDITOR recebem 403', async () => {
    const app = await obterApp();
    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id, { statusProcessamento: StatusLote.RECEBIDO });

    const operador = await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });
    const auditor = await db.semear.usuario({ papel: PapelUsuario.AUDITOR });

    const resOp = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lotes/${lote.id}/status`,
      headers: await autenticado(operador),
      payload: { status: StatusLote.EM_TRIAGEM },
    });
    expect(resOp.statusCode).toBe(403);

    const resAud = await app.inject({
      method: 'PATCH',
      url: `/api/v1/lotes/${lote.id}/status`,
      headers: await autenticado(auditor),
      payload: { status: StatusLote.EM_TRIAGEM },
    });
    expect(resAud.statusCode).toBe(403);
  });
});
