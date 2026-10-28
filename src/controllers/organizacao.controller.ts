import { FastifyRequest, FastifyReply } from 'fastify';
import { OrganizacaoService } from '../services/organizacao.service.js';
import { sendCreated, sendList } from '../http/response.js';
import type { CriarOrganizacaoRoute } from '../schemas/organizacao.schema.js';

export class OrganizacaoController {
  static async index(_request: FastifyRequest, reply: FastifyReply) {
    const organizacoes = await OrganizacaoService.listarTodas();
    return sendList(reply, organizacoes);
  }

  static async store(request: FastifyRequest<CriarOrganizacaoRoute>, reply: FastifyReply) {
    const organizacao = await OrganizacaoService.criarOrganizacao(request.body);
    return sendCreated(reply, organizacao, { message: 'Organização criada com sucesso.' });
  }
}
