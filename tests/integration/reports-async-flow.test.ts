import { rm } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import {
  EstadoFisico,
  StatusLote,
  StatusRastreamento,
  TipoEquipamento,
} from '../../src/domain/shared/enums.js';
import {
  handleReportExportJobFailed,
  processReportExportJob,
} from '../../src/infrastructure/queue/workers.js';
import { autenticado, fecharApp, obterApp } from '../helpers/app.js';
import { db } from '../helpers/fakes.js';

const arquivosGerados: string[] = [];

afterAll(async () => {
  await Promise.allSettled(
    arquivosGerados.map((filePath) => rm(filePath, { force: true })),
  );
  await fecharApp();
});

describe('Fluxo Assíncrono de Relatórios B2B — POST /api/v1/public/reports e GET /api/v1/public/reports/:id (SPEC-004)', () => {
  async function criarChaveRelatorios(partnerName = 'Parceiro Reports B2B'): Promise<string> {
    const app = await obterApp();
    const admin = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/internal/api-keys',
      headers: await autenticado(admin),
      payload: {
        partnerName,
        scopes: ['read:reports'],
        rateLimit: 100,
      },
    });
    return res.json().data.rawKey;
  }

  it('Ciclo completo CSV: POST retorna 202 (PENDING) -> Worker processa -> GET retorna COMPLETED -> GET ?download=true faz stream do CSV', async () => {
    const app = await obterApp();
    const rawKey = await criarChaveRelatorios('Parceiro CSV');

    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id, {
      statusProcessamento: StatusLote.FINALIZADO,
    });
    await db.semear.equipamento(lote.id, {
      tipo: TipoEquipamento.NOTEBOOK,
      marca: 'Dell',
      modelo: 'Latitude 5420',
      estadoFisico: EstadoFisico.BOM_ESTADO,
      pesoQuilogramas: 2.5,
      statusRastreamento: StatusRastreamento.PECAS_REAPROVEITADAS,
    });

    // 1. Solicita relatório CSV (202 Accepted imediato)
    const resPost = await app.inject({
      method: 'POST',
      url: '/api/v1/public/reports',
      headers: { 'x-api-key': rawKey },
      payload: {
        reportType: 'PROFITABILITY',
        format: 'CSV',
      },
    });

    expect(resPost.statusCode).toBe(202);
    const { jobId, status } = resPost.json().data;
    expect(jobId).toBeDefined();
    expect(status).toBe('PENDING');

    // 2. Consulta status antes do worker rodar (200 PENDING) e bloqueia download precoce (400)
    const resPending = await app.inject({
      method: 'GET',
      url: `/api/v1/public/reports/${jobId}`,
      headers: { 'x-api-key': rawKey },
    });
    expect(resPending.statusCode).toBe(200);
    expect(resPending.json().data.status).toBe('PENDING');

    const resDownloadPrecoce = await app.inject({
      method: 'GET',
      url: `/api/v1/public/reports/${jobId}?download=true`,
      headers: { 'x-api-key': rawKey },
    });
    expect(resDownloadPrecoce.statusCode).toBe(400);

    // 3. Worker processa o job em background
    const jobProcessado = await processReportExportJob(db.enqueuedReports[0]!);
    if (jobProcessado.filePath) arquivosGerados.push(jobProcessado.filePath);

    // 4. Polling retorna COMPLETED
    const resCompleted = await app.inject({
      method: 'GET',
      url: `/api/v1/public/reports/${jobId}`,
      headers: { 'x-api-key': rawKey },
    });
    expect(resCompleted.statusCode).toBe(200);
    expect(resCompleted.json().data.status).toBe('COMPLETED');
    expect(resCompleted.json().data.completedAt).toBeTruthy();

    // 5. Download do arquivo CSV (?download=true)
    const resDownload = await app.inject({
      method: 'GET',
      url: `/api/v1/public/reports/${jobId}?download=true`,
      headers: { 'x-api-key': rawKey },
    });
    expect(resDownload.statusCode).toBe(200);
    expect(resDownload.headers['content-type']).toContain('text/csv');
    expect(resDownload.headers['content-disposition']).toContain('.csv');
    expect(resDownload.body).toContain('estadoFisico,marca,modelo');
    expect(resDownload.body).toContain('BOM_ESTADO,Dell,Latitude 5420');
  });

  it('Ciclo completo JSON e isolamento entre parceiros: parceiro diferente recebe 404 Not Found', async () => {
    const app = await obterApp();
    const keyParceiroA = await criarChaveRelatorios('Parceiro A');
    const keyParceiroB = await criarChaveRelatorios('Parceiro B');

    const resPost = await app.inject({
      method: 'POST',
      url: '/api/v1/public/reports',
      headers: { 'x-api-key': keyParceiroA },
      payload: {
        reportType: 'EFFICIENCY',
        format: 'JSON',
      },
    });
    expect(resPost.statusCode).toBe(202);
    const { jobId } = resPost.json().data;

    const jobProcessado = await processReportExportJob(db.enqueuedReports[0]!);
    if (jobProcessado.filePath) arquivosGerados.push(jobProcessado.filePath);

    // Parceiro B tenta consultar ou baixar o relatório do Parceiro A -> 404
    const resIntruso = await app.inject({
      method: 'GET',
      url: `/api/v1/public/reports/${jobId}`,
      headers: { 'x-api-key': keyParceiroB },
    });
    expect(resIntruso.statusCode).toBe(404);

    // Parceiro A baixa o JSON com sucesso
    const resDownloadJson = await app.inject({
      method: 'GET',
      url: `/api/v1/public/reports/${jobId}?download=true`,
      headers: { 'x-api-key': keyParceiroA },
    });
    expect(resDownloadJson.statusCode).toBe(200);
    expect(resDownloadJson.headers['content-type']).toContain('application/json');
    expect(JSON.parse(resDownloadJson.body)).toHaveProperty('totalAnalisado');
  });

  it('Falha após 3 tentativas no worker marca ReportJob como FAILED com errorReason no polling HTTP', async () => {
    const app = await obterApp();
    const rawKey = await criarChaveRelatorios('Parceiro Retry');

    const resPost = await app.inject({
      method: 'POST',
      url: '/api/v1/public/reports',
      headers: { 'x-api-key': rawKey },
      payload: {
        reportType: 'TRACEABILITY',
        format: 'CSV',
      },
    });
    const { jobId } = resPost.json().data;

    await handleReportExportJobFailed(
      {
        data: db.enqueuedReports[0]!,
        attemptsMade: 3,
        opts: { attempts: 3 },
      },
      new Error('Falha simulada após 3 tentativas'),
    );

    const resFailed = await app.inject({
      method: 'GET',
      url: `/api/v1/public/reports/${jobId}`,
      headers: { 'x-api-key': rawKey },
    });
    expect(resFailed.statusCode).toBe(200);
    expect(resFailed.json().data).toMatchObject({
      jobId,
      status: 'FAILED',
      errorReason: 'Falha simulada após 3 tentativas',
    });
  });
});
