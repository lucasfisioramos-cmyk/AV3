import { invalido, valido, type ResultadoValidacao } from './resultado.js';

/** Janela máxima (em dias) para registrar a entrada de um lote retroativamente. */
export const JANELA_ENTRADA_LOTE_DIAS = 90;

/**
 * Valida a data de entrada de um lote: não pode ser futura nem anterior à janela de 90 dias.
 * `agora` é parâmetro para manter a função pura e testável.
 */
export function validarDataEntrada(dataEntrada: Date, agora: Date = new Date()): ResultadoValidacao {
  if (Number.isNaN(dataEntrada.getTime())) {
    return invalido('A data de entrada do lote é inválida.');
  }

  if (dataEntrada > agora) {
    return invalido('A data de entrada do lote não pode ser uma data futura.');
  }

  const limiteInferior = new Date(agora);
  limiteInferior.setDate(limiteInferior.getDate() - JANELA_ENTRADA_LOTE_DIAS);

  if (dataEntrada < limiteInferior) {
    return invalido(`A data de entrada do lote não pode ser anterior a ${JANELA_ENTRADA_LOTE_DIAS} dias.`);
  }

  return valido();
}
