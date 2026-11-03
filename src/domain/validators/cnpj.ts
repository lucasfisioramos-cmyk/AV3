import { invalido, valido, type ResultadoValidacao } from './resultado.js';

/** Remove qualquer máscara, mantendo apenas os dígitos. */
export function normalizarCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

function calcularDigito(base: string): number {
  // Pesos de 2 a 9, aplicados da direita para a esquerda.
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida formato (14 dígitos) e dígitos verificadores do CNPJ, com ou sem máscara. */
export function validarCNPJ(cnpj: string): ResultadoValidacao {
  const digitos = normalizarCNPJ(cnpj);

  if (digitos.length !== 14) return invalido('O CNPJ deve conter 14 dígitos.');
  if (/^(\d)\1+$/.test(digitos)) return invalido('CNPJ com todos os dígitos iguais é inválido.');

  const primeiro = calcularDigito(digitos.slice(0, 12));
  const segundo = calcularDigito(digitos.slice(0, 12) + primeiro);

  return digitos.endsWith(`${primeiro}${segundo}`) ? valido() : invalido('Checksum incorreto.');
}
