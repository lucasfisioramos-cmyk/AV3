import { StatusLote } from '@prisma/client';
import { ConflictError } from '../../errors/app-error.js';
import { exigirValido } from '../shared/guards.js';
import { validarDataEntrada } from '../validators/index.js';

export const LoteRules = {
  /** 🔒 REGRA LEGADA (AV1): data de entrada não pode ser futura nem anterior a 90 dias. */
  exigirDataEntradaValida(dataEntrada: Date, agora: Date = new Date()): void {
    exigirValido(validarDataEntrada(dataEntrada, agora), (motivo) => `Regra Violada: ${motivo}`);
  },

  garantirNotaFiscalInedita(notaFiscal: string, existente: unknown): void {
    if (existente) {
      throw new ConflictError(
        `Já existe um lote cadastrado com a Nota Fiscal "${notaFiscal}" para esta organização.`
      );
    }
  },

  /** O primeiro equipamento cadastrado move o lote de RECEBIDO para EM_TRIAGEM. */
  deveIniciarTriagem(lote: { statusProcessamento: StatusLote }): boolean {
    return lote.statusProcessamento === StatusLote.RECEBIDO;
  },
};
