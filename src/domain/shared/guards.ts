import { NotFoundError, RegraDeNegocioError } from '../../errors/app-error.js';
import type { ResultadoValidacao } from '../validators/resultado.js';

/** Garante que o recurso existe; caso contrário lança NotFoundError (404). */
export function exigirEncontrado<T>(recurso: T | null | undefined, mensagem: string): T {
  if (recurso === null || recurso === undefined) throw new NotFoundError(mensagem);
  return recurso;
}

/**
 * Converte um ResultadoValidacao em exceção de regra de negócio (400).
 * `formatar` permite compor a mensagem final (prefixo, valor informado etc.).
 */
export function exigirValido(
  resultado: ResultadoValidacao,
  formatar: (mensagem: string) => string = (m) => m
): void {
  if (!resultado.valido) throw new RegraDeNegocioError(formatar(resultado.mensagem));
}
