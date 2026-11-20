import { afterAll, describe, expect, it } from 'vitest';
import { autenticado, fecharApp, obterApp } from '../helpers/app.js';
import { db } from '../helpers/fakes.js';
import { PapelUsuario } from '../../src/domain/shared/enums.js';

afterAll(fecharApp);

describe('Módulo de Contrato vinculado a Organização (TASK-09 / N4)', () => {
  const agora = new Date();
  const futuro = new Date(agora.getTime() + 365 * 24 * 3600 * 1000);
  const futuroMaisLonge = new Date(agora.getTime() + 730 * 24 * 3600 * 1000);

  const payloadContratoValido = {
    dataAssinatura: agora.toISOString(),
    dataVencimento: futuro.toISOString(),
    clausulas: ['Cláusula 1: Coleta de resíduos eletrônicos', 'Cláusula 2: Destinação ambientalmente adequada'],
    valorMensal: 2500.5,
    renovacaoAutomatica: true,
  };

  it('criação (POST /api/v1/organizacoes/:id/contrato): OPERADOR_CADASTRO e ADMINISTRADOR podem criar (201)', async () => {
    const app = await obterApp();
    const org1 = await db.semear.organizacao();
    const operador = await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });

    const resOp = await app.inject({
      method: 'POST',
      url: `/api/v1/organizacoes/${org1.id}/contrato`,
      headers: await autenticado(operador),
      payload: payloadContratoValido,
    });
    expect(resOp.statusCode).toBe(201);
    expect(resOp.json()).toMatchObject({
      data: {
        organizacaoId: org1.id,
        valorMensal: 2500.5,
        ativo: true,
      },
      message: 'Contrato vinculado com sucesso à organização.',
    });

    const org2 = await db.semear.organizacao({ cnpj: '22333444000199' });
    const admin = await db.semear.usuario({ papel: PapelUsuario.ADMINISTRADOR });
    const resAdm = await app.inject({
      method: 'POST',
      url: `/api/v1/organizacoes/${org2.id}/contrato`,
      headers: await autenticado(admin),
      payload: payloadContratoValido,
    });
    expect(resAdm.statusCode).toBe(201);
  });

  it('autorização (RBAC): GESTOR_ALMOXARIFADO e AUDITOR recebem 403 na criação', async () => {
    const app = await obterApp();
    const org = await db.semear.organizacao({ cnpj: '33444555000188' });
    const gestor = await db.semear.usuario({ papel: PapelUsuario.GESTOR_ALMOXARIFADO });
    const auditor = await db.semear.usuario({ papel: PapelUsuario.AUDITOR });

    const resGestor = await app.inject({
      method: 'POST',
      url: `/api/v1/organizacoes/${org.id}/contrato`,
      headers: await autenticado(gestor),
      payload: payloadContratoValido,
    });
    expect(resGestor.statusCode).toBe(403);

    const resAuditor = await app.inject({
      method: 'POST',
      url: `/api/v1/organizacoes/${org.id}/contrato`,
      headers: await autenticado(auditor),
      payload: payloadContratoValido,
    });
    expect(resAuditor.statusCode).toBe(403);
  });

  it('regras de negócio na criação: bloqueia segundo contrato vigente (409) e validações de data/valor/cláusulas (400)', async () => {
    const app = await obterApp();
    const org = await db.semear.organizacao({ cnpj: '44555666000177' });
    const operador = await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });

    // Cria o primeiro
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/organizacoes/${org.id}/contrato`,
      headers: await autenticado(operador),
      payload: payloadContratoValido,
    });
    expect(res1.statusCode).toBe(201);

    // Tenta criar segundo contrato vigente para a mesma organização -> 409
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/organizacoes/${org.id}/contrato`,
      headers: await autenticado(operador),
      payload: payloadContratoValido,
    });
    expect(res2.statusCode).toBe(409);

    const orgSemContrato = await db.semear.organizacao({ cnpj: '55666777000166' });

    // Vencimento anterior à assinatura -> 400
    const resDataInvalida = await app.inject({
      method: 'POST',
      url: `/api/v1/organizacoes/${orgSemContrato.id}/contrato`,
      headers: await autenticado(operador),
      payload: { ...payloadContratoValido, dataVencimento: new Date(agora.getTime() - 1000).toISOString() },
    });
    expect(resDataInvalida.statusCode).toBe(400);

    // Valor mensal zero ou negativo -> 400
    const resValorInvalido = await app.inject({
      method: 'POST',
      url: `/api/v1/organizacoes/${orgSemContrato.id}/contrato`,
      headers: await autenticado(operador),
      payload: { ...payloadContratoValido, valorMensal: -10 },
    });
    expect(resValorInvalido.statusCode).toBe(400);

    // Cláusulas vazias -> 400
    const resClausulaVazia = await app.inject({
      method: 'POST',
      url: `/api/v1/organizacoes/${orgSemContrato.id}/contrato`,
      headers: await autenticado(operador),
      payload: { ...payloadContratoValido, clausulas: [] },
    });
    expect(resClausulaVazia.statusCode).toBe(400);
  });

  it('consulta de contrato vigente (GET /api/v1/organizacoes/:id/contrato): 200 para ativo e 404 quando ausente', async () => {
    const app = await obterApp();
    const org = await db.semear.organizacao({ cnpj: '66777888000155' });
    const auditor = await db.semear.usuario({ papel: PapelUsuario.AUDITOR });

    // Sem contrato ainda -> 404
    const resVazio = await app.inject({
      method: 'GET',
      url: `/api/v1/organizacoes/${org.id}/contrato`,
      headers: await autenticado(auditor),
    });
    expect(resVazio.statusCode).toBe(404);

    // Cria contrato
    await db.semear.contrato(org.id, { valorMensal: 3000 });

    // Com contrato -> 200
    const resAtivo = await app.inject({
      method: 'GET',
      url: `/api/v1/organizacoes/${org.id}/contrato`,
      headers: await autenticado(auditor),
    });
    expect(resAtivo.statusCode).toBe(200);
    expect(resAtivo.json().data.valorMensal).toBe(3000);
  });

  it('renovação (PATCH /api/v1/organizacoes/:id/contrato/renovar): atualiza novoVencimento posterior (200) e rejeita data inválida (400)', async () => {
    const app = await obterApp();
    const org = await db.semear.organizacao({ cnpj: '77888999000144' });
    const operador = await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });
    await db.semear.contrato(org.id, { dataVencimento: futuro });

    // Tenta renovar com data anterior ao vencimento atual -> 400
    const resInvalido = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizacoes/${org.id}/contrato/renovar`,
      headers: await autenticado(operador),
      payload: { novoVencimento: new Date(futuro.getTime() - 1000).toISOString() },
    });
    expect(resInvalido.statusCode).toBe(400);

    // Renova com data posterior válida -> 200
    const resValido = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizacoes/${org.id}/contrato/renovar`,
      headers: await autenticado(operador),
      payload: { novoVencimento: futuroMaisLonge.toISOString() },
    });
    expect(resValido.statusCode).toBe(200);
    expect(resValido.json()).toMatchObject({
      data: {
        organizacaoId: org.id,
      },
      message: 'Contrato renovado com sucesso.',
    });
  });

  it('encerramento (DELETE /api/v1/organizacoes/:id/contrato): desativa contrato vigente e permite novo contrato posterior', async () => {
    const app = await obterApp();
    const org = await db.semear.organizacao({ cnpj: '88999000000133' });
    const operador = await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });
    await db.semear.contrato(org.id);

    // Encerra o contrato vigente -> 200
    const resEncerramento = await app.inject({
      method: 'DELETE',
      url: `/api/v1/organizacoes/${org.id}/contrato`,
      headers: await autenticado(operador),
    });
    expect(resEncerramento.statusCode).toBe(200);

    // Consulta de vigente agora deve ser 404
    const resConsulta = await app.inject({
      method: 'GET',
      url: `/api/v1/organizacoes/${org.id}/contrato`,
      headers: await autenticado(operador),
    });
    expect(resConsulta.statusCode).toBe(404);

    // Agora é possível criar um novo contrato para a organização (mantendo histórico)
    const resNovo = await app.inject({
      method: 'POST',
      url: `/api/v1/organizacoes/${org.id}/contrato`,
      headers: await autenticado(operador),
      payload: { ...payloadContratoValido, valorMensal: 4000 },
    });
    expect(resNovo.statusCode).toBe(201);
  });

  it('GET /api/v1/organizacoes/:id inclui dados do contratoVigente (ou null quando ausente)', async () => {
    const app = await obterApp();
    const admin = await db.semear.usuario({ papel: PapelUsuario.ADMINISTRADOR });
    const org = await db.semear.organizacao({ cnpj: '99000111000122' });

    // Sem contrato vigente
    const resSemContrato = await app.inject({
      method: 'GET',
      url: `/api/v1/organizacoes/${org.id}`,
      headers: await autenticado(admin),
    });
    expect(resSemContrato.statusCode).toBe(200);
    expect(resSemContrato.json().data.contratoVigente).toBeNull();

    // Com contrato vigente
    await db.semear.contrato(org.id, { valorMensal: 5500 });
    const resComContrato = await app.inject({
      method: 'GET',
      url: `/api/v1/organizacoes/${org.id}`,
      headers: await autenticado(admin),
    });
    expect(resComContrato.statusCode).toBe(200);
    expect(resComContrato.json().data.contratoVigente).toMatchObject({
      organizacaoId: org.id,
      valorMensal: 5500,
      ativo: true,
    });
  });
});
