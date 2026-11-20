import { FastifyRequest, FastifyReply } from 'fastify';
import { ContratoService } from '../domain/contrato/contrato.service.js';
import { sendCreated, sendSuccess } from '../http/response.js';
import type {
  CriarContratoRoute,
  RenovarContratoRoute,
  ContratoRoute,
} from '../schemas/contrato.schema.js';

export class ContratoController {
  static async store(request: FastifyRequest<CriarContratoRoute>, reply: FastifyReply) {
    const { id } = request.params;
    const contrato = await ContratoService.criarContrato({
      organizacaoId: id,
      ...request.body,
    });
    return sendCreated(reply, contrato, { message: 'Contrato vinculado com sucesso à organização.' });
  }

  static async showVigente(request: FastifyRequest<ContratoRoute>, reply: FastifyReply) {
    const { id } = request.params;
    const contrato = await ContratoService.buscarContratoVigente(id);
    return sendSuccess(reply, contrato);
  }

  static async renovar(request: FastifyRequest<RenovarContratoRoute>, reply: FastifyReply) {
    const { id } = request.params;
    const contrato = await ContratoService.renovarContrato({
      organizacaoId: id,
      novoVencimento: request.body.novoVencimento,
    });
    return sendSuccess(reply, contrato, { message: 'Contrato renovado com sucesso.' });
  }

  static async encerrar(request: FastifyRequest<ContratoRoute>, reply: FastifyReply) {
    const { id } = request.params;
    await ContratoService.encerrarContratoVigente(id);
    return sendSuccess(reply, null, { message: 'Contrato vigente encerrado com sucesso.' });
  }
}
