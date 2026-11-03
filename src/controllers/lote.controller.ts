import { FastifyRequest, FastifyReply } from 'fastify';
import { LoteService } from '../domain/lote/lote.service.js';
import { sendCreated, sendList, sendSuccess } from '../http/response.js';
import type { BuscarLoteRoute, CriarLoteRoute } from '../schemas/lote.schema.js';

export class LoteController {
  static async index(_request: FastifyRequest, reply: FastifyReply) {
    const lotes = await LoteService.listarLotes();
    return sendList(reply, lotes);
  }

  static async show(request: FastifyRequest<BuscarLoteRoute>, reply: FastifyReply) {
    const lote = await LoteService.buscarPorId(request.params.id);
    return sendSuccess(reply, lote);
  }

  static async store(request: FastifyRequest<CriarLoteRoute>, reply: FastifyReply) {
    const lote = await LoteService.criarLote(request.body);
    return sendCreated(reply, lote, { message: 'Lote criado com sucesso.' });
  }
}
