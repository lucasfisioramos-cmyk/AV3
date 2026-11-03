import { FastifyRequest, FastifyReply } from 'fastify';
import { EquipamentoService } from '../domain/equipamento/equipamento.service.js';
import { sendCreated, sendSuccess } from '../http/response.js';
import type {
  AlterarEstadoFisicoRoute,
  CriarEquipamentoRoute,
  MovimentarEquipamentoRoute,
  RastrearEquipamentoRoute,
} from '../schemas/equipamento.schema.js';

export class EquipamentoController {
  // 1. Cadastrar novo equipamento (método 'store')
  static async store(request: FastifyRequest<CriarEquipamentoRoute>, reply: FastifyReply) {
    const equipamento = await EquipamentoService.criarEquipamento(request.body);
    return sendCreated(reply, equipamento, { message: 'Equipamento cadastrado com sucesso.' });
  }

  // 2. Movimentar equipamento
  static async movimentar(request: FastifyRequest<MovimentarEquipamentoRoute>, reply: FastifyReply) {
    const resultado = await EquipamentoService.movimentarEquipamento({
      id: request.params.id,
      ...request.body,
    });

    return sendSuccess(reply, resultado, { message: 'Equipamento movimentado com sucesso!' });
  }

  // 3. Alterar estado físico com verificação de justificativa (método 'alterarEstadoFisico')
  static async alterarEstadoFisico(request: FastifyRequest<AlterarEstadoFisicoRoute>, reply: FastifyReply) {
    const equipamento = await EquipamentoService.alterarEstadoFisico({
      id: request.params.id,
      ...request.body,
    });

    return sendSuccess(reply, equipamento, { message: 'Estado físico atualizado com sucesso.' });
  }

  // 4. Rastrear equipamento por ID ou código de barras
  static async rastrear(request: FastifyRequest<RastrearEquipamentoRoute>, reply: FastifyReply) {
    const equipamento = await EquipamentoService.rastrear(request.params.identificador);
    return sendSuccess(reply, equipamento);
  }
}
