import { FastifyRequest, FastifyReply } from 'fastify';
import { OrganizacaoService } from '../domain/organizacao/organizacao.service.js';
import { sendCreated, sendList, sendSuccess } from '../http/response.js';
import type {
  BuscarOrganizacaoRoute,
  CriarOrganizacaoRoute,
  DesativarOrganizacaoRoute,
  EditarOrganizacaoRoute,
  ListarOrganizacoesRoute,
} from '../schemas/organizacao.schema.js';

export class OrganizacaoController {
  static async index(request: FastifyRequest<ListarOrganizacoesRoute>, reply: FastifyReply) {
    const { itens, total, page, limit } = await OrganizacaoService.listarTodas(request.query);
    return sendList(reply, itens, { total, page, limit });
  }

  static async show(request: FastifyRequest<BuscarOrganizacaoRoute>, reply: FastifyReply) {
    const organizacao = await OrganizacaoService.buscarPorId(request.params.id);
    return sendSuccess(reply, organizacao);
  }

  static async store(request: FastifyRequest<CriarOrganizacaoRoute>, reply: FastifyReply) {
    const organizacao = await OrganizacaoService.criarOrganizacao(request.body);
    return sendCreated(reply, organizacao, { message: 'Organização criada com sucesso.' });
  }

  static async update(request: FastifyRequest<EditarOrganizacaoRoute>, reply: FastifyReply) {
    const organizacao = await OrganizacaoService.editarOrganizacao(request.params.id, request.body);
    return sendSuccess(reply, organizacao, { message: 'Organização atualizada com sucesso.' });
  }

  static async desativar(request: FastifyRequest<DesativarOrganizacaoRoute>, reply: FastifyReply) {
    const organizacao = await OrganizacaoService.desativarOrganizacao(request.params.id);
    return sendSuccess(reply, organizacao, { message: 'Organização desativada com sucesso.' });
  }
}
