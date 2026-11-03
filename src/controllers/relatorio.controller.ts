import { FastifyRequest, FastifyReply } from 'fastify';
import { RelatorioService } from '../domain/relatorio/relatorio.service.js';
import { sendSuccess } from '../http/response.js';
import type { IdParams } from '../schemas/common.schema.js';

export class RelatorioController {
  static async dashboardGeral(_request: FastifyRequest, reply: FastifyReply) {
    const dados = await RelatorioService.obterDashboardGeral();
    return sendSuccess(reply, dados);
  }

  // Erros (ex.: organização inexistente) seguem para o handler global.
  static async relatorioOrganizacao(request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) {
    const dados = await RelatorioService.obterRelatorioOrganizacao(request.params.id);
    return sendSuccess(reply, dados);
  }
}
