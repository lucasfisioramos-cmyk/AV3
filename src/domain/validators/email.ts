import { invalido, valido, type ResultadoValidacao } from './resultado.js';

// Pragmático: algo@dominio.tld, sem espaços. A verificação real é o envio de e-mail.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarEmail(email: string): ResultadoValidacao {
  return EMAIL.test(email.trim()) && email.length <= 254 ? valido() : invalido('E-mail em formato inválido.');
}
