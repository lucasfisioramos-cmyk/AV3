import { PapelUsuario } from '../shared/enums.js';
import { invalido, valido, type ResultadoValidacao } from './resultado.js';

const PAPEIS: readonly string[] = Object.values(PapelUsuario);

export function validarPapel(papel: unknown): ResultadoValidacao {
  return typeof papel === 'string' && PAPEIS.includes(papel)
    ? valido()
    : invalido(`Papel inválido. Valores aceitos: ${PAPEIS.join(', ')}.`);
}
