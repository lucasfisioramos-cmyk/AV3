import { FastifyRequest, FastifyReply } from 'fastify';
import { LoteService } from '../domain/lote/lote.service.js';
import { sendCreated, sendList, sendSuccess } from '../http/response.js';
import type {
  AtualizarStatusLoteRoute,
  BuscarLoteRoute,
  CriarLoteRoute,
  EditarLoteRoute,
  ExcluirLoteRoute,
  ListarLotesRoute,
} from '../schemas/lote.schema.js';

export class LoteController {
  static async index(request: FastifyRequest<ListarLotesRoute>, reply: FastifyReply) {
    const { itens, total, page, limit } = await LoteService.listarLotes(request.query);
    return sendList(reply, itens, { total, page, limit });
  }

  static async show(request: FastifyRequest<BuscarLoteRoute>, reply: FastifyReply) {
    const lote = await LoteService.buscarPorId(request.params.id);
    return sendSuccess(reply, lote);
  }

  static async store(request: FastifyRequest<CriarLoteRoute>, reply: FastifyReply) {
    const lote = await LoteService.criarLote(request.body);
    return sendCreated(reply, lote, { message: 'Lote criado com sucesso.' });
  }

  static async updateStatus(request: FastifyRequest<AtualizarStatusLoteRoute>, reply: FastifyReply) {
    const { id } = request.params;
    const { status } = request.body;
    const lote = await LoteService.atualizarStatus({ loteId: id, novoStatus: status });
    return sendSuccess(reply, lote, { message: 'Status do lote atualizado com sucesso.' });
  }

  static async update(request: FastifyRequest<EditarLoteRoute>, reply: FastifyReply) {
    const lote = await LoteService.editarLote(request.params.id, request.body);
    return sendSuccess(reply, lote, { message: 'Lote atualizado com sucesso.' });
  }

  static async delete(request: FastifyRequest<ExcluirLoteRoute>, reply: FastifyReply) {
    await LoteService.excluirLote(request.params.id);
    return sendSuccess(reply, null, { message: 'Lote excluído com sucesso.' });
  }
}
