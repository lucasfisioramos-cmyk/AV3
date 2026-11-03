import { LoteRepository } from '../../repositories/lote.repository.js';
import { OrganizacaoRepository } from '../../repositories/organizacao.repository.js';
import { exigirEncontrado } from '../shared/guards.js';
import { LoteRules } from './lote.rules.js';

export interface CriarLoteInput {
  organizacaoId: string;
  notaFiscal: string;
  transportadora: string;
  dataEntrada?: Date | string;
  observacoes?: string;
}

export class LoteService {
  // Transação: NÃO. Escrita única. Limitação conhecida: não há constraint unique
  // (notaFiscal, organizacaoId) no schema; a checagem abaixo não cobre requisições simultâneas.
  static async criarLote(data: CriarLoteInput) {
    exigirEncontrado(
      await OrganizacaoRepository.findById(data.organizacaoId),
      'Organização de origem não encontrada.'
    );

    const dataEntrada = data.dataEntrada ? new Date(data.dataEntrada) : new Date();
    LoteRules.exigirDataEntradaValida(dataEntrada);

    const loteExistente = await LoteRepository.findByNotaFiscalEOrganizacao(
      data.notaFiscal,
      data.organizacaoId
    );
    LoteRules.garantirNotaFiscalInedita(data.notaFiscal, loteExistente);

    return LoteRepository.create(data);
  }

  static async listarLotes() {
    return LoteRepository.findAll();
  }

  static async buscarPorId(id: string) {
    return exigirEncontrado(await LoteRepository.findById(id), 'Lote não encontrado.');
  }
}
