import { invalido, valido, type ResultadoValidacao } from './resultado.js';

/**
 * Política de senha. O limite superior existe porque o bcrypt só considera
 * os 72 primeiros BYTES; a política de complexidade fica para a camada de segurança.
 */
export const POLITICA_SENHA = {
  minimoCaracteres: 1,
  maximoBytes: 72,
} as const;

export function validarSenha(senha: string): ResultadoValidacao {
  if (senha.trim().length < POLITICA_SENHA.minimoCaracteres) {
    return invalido('A senha não pode ser vazia.');
  }
  if (Buffer.byteLength(senha, 'utf8') > POLITICA_SENHA.maximoBytes) {
    return invalido(`A senha deve ter no máximo ${POLITICA_SENHA.maximoBytes} bytes.`);
  }
  return valido();
}
