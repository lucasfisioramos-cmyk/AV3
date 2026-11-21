import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ReportJobService } from '../../../domain/report/report-job.service.js';
import { ReportFormat, ReportJobStatus } from '../../../domain/shared/enums.js';
import { sendSuccess } from '../../../http/response.js';
import { REPORT_TYPES } from '../../../infrastructure/queue/queues.js';
import {
  dateTimeSchema,
  envelope,
  errors,
  idParamsSchema,
  type IdParams,
} from '../../../schemas/common.schema.js';
import { authorizeApiKey } from '../../hooks/authorize-api-key.js';

export const solicitarRelatorioBodySchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  format: z.enum([ReportFormat.CSV, ReportFormat.JSON]),
  filters: z.record(z.string(), z.unknown()).optional(),
});
export type SolicitarRelatorioBody = z.infer<typeof solicitarRelatorioBodySchema>;

export const consultarRelatorioQuerySchema = z.object({
  download: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
});
export type ConsultarRelatorioQuery = z.infer<typeof consultarRelatorioQuerySchema>;

export const reportJobAcceptedDataSchema = z.object({
  jobId: z.uuid(),
  id: z.uuid(),
  bullJobId: z.string().nullable(),
  status: z.enum([
    ReportJobStatus.PENDING,
    ReportJobStatus.PROCESSING,
    ReportJobStatus.COMPLETED,
    ReportJobStatus.FAILED,
  ]),
  reportType: z.string(),
  format: z.enum([ReportFormat.CSV, ReportFormat.JSON]),
  createdAt: dateTimeSchema,
});

export const reportJobDetailDataSchema = reportJobAcceptedDataSchema.extend({
  apiKeyId: z.uuid(),
  filePath: z.string().nullable(),
  errorReason: z.string().nullable(),
  completedAt: dateTimeSchema.nullable(),
});

export const reportJobAcceptedResponseSchema = envelope(reportJobAcceptedDataSchema);
export const reportJobDetailResponseSchema = envelope(reportJobDetailDataSchema);

export async function reportRoutes(app: FastifyInstance) {
  const publicRateLimiter = app.rateLimit({
    keyGenerator: (req) => req.apiKey?.id ?? req.ip,
    max: (req) => req.apiKey?.rateLimit ?? 60,
    timeWindow: '1 minute',
  });

  app.post<{ Body: SolicitarRelatorioBody }>(
    '/reports',
    {
      config: { rateLimit: false },
      onRequest: [authorizeApiKey('read:reports'), publicRateLimiter],
      schema: {
        tags: ['Público - Relatórios Assíncronos B2B'],
        summary: 'Solicita geração assíncrona de relatório analítico ou de rastreabilidade (CSV/JSON)',
        security: [{ apiKeyAuth: [] }],
        body: solicitarRelatorioBodySchema,
        response: {
          202: reportJobAcceptedResponseSchema,
          ...errors(400, 401, 403, 429),
        },
      },
    },
    async (request, reply) => {
      const job = await ReportJobService.solicitarRelatorio(
        request.apiKey!.id,
        request.body,
      );

      return sendSuccess(
        reply,
        {
          jobId: job.id,
          id: job.id,
          bullJobId: job.bullJobId,
          status: job.status,
          reportType: job.reportType,
          format: job.format,
          createdAt: job.createdAt,
        },
        {
          status: 202,
          message:
            'Solicitação de relatório recebida e enfileirada para processamento assíncrono.',
        },
      );
    },
  );

  app.get<{ Params: IdParams; Querystring: ConsultarRelatorioQuery }>(
    '/reports/:id',
    {
      config: { rateLimit: false },
      onRequest: [authorizeApiKey('read:reports'), publicRateLimiter],
      schema: {
        tags: ['Público - Relatórios Assíncronos B2B'],
        summary: 'Consulta o status de um job de relatório ou baixa o arquivo gerado (?download=true)',
        security: [{ apiKeyAuth: [] }],
        params: idParamsSchema,
        querystring: consultarRelatorioQuerySchema,
        response: {
          200: reportJobDetailResponseSchema,
          ...errors(400, 401, 403, 404, 429),
        },
      },
    },
    async (request, reply) => {
      if (request.query.download) {
        const { content, contentType, fileName } =
          await ReportJobService.obterArquivoRelatorio(
            request.apiKey!.id,
            request.params.id,
          );

        reply.header('Content-Type', contentType);
        reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
        return reply.status(200).send(Buffer.from(content, 'utf-8'));
      }

      const job = await ReportJobService.consultarRelatorio(
        request.apiKey!.id,
        request.params.id,
      );

      return sendSuccess(reply, {
        jobId: job.id,
        id: job.id,
        bullJobId: job.bullJobId,
        apiKeyId: job.apiKeyId,
        reportType: job.reportType,
        format: job.format,
        status: job.status,
        filePath: job.filePath,
        errorReason: job.errorReason,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      });
    },
  );
}
