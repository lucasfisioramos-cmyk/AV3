import { describe, expect, it } from 'vitest';
import { normalizarCNPJ, validarCNPJ } from '../../../src/domain/validators/cnpj.js';

function digito(base: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

const gerarValido = (base12: string) => {
  const d1 = digito(base12);
  return base12 + d1 + digito(base12 + d1);
};

describe('validarCNPJ', () => {
  it.each(['11222333000181', '11.222.333/0001-81', '  11.222.333/0001-81 '])('aceita CNPJ válido (%s)', (cnpj) => {
    expect(validarCNPJ(cnpj)).toEqual({ valido: true });
  });

  it('rejeita dígito verificador incorreto', () => {
    expect(validarCNPJ('11222333000182')).toEqual({ valido: false, mensagem: 'Checksum incorreto.' });
  });

  it.each(['', '123', '1122233300018', '112223330001811'])('rejeita quantidade de dígitos incorreta (%s)', (cnpj) => {
    expect(validarCNPJ(cnpj)).toEqual({ valido: false, mensagem: 'O CNPJ deve conter 14 dígitos.' });
  });

  it.each(['00000000000000', '11111111111111', '99999999999999'])('rejeita todos os dígitos iguais (%s)', (cnpj) => {
    expect(validarCNPJ(cnpj).valido).toBe(false);
  });

  it('aceita qualquer CNPJ gerado pelo algoritmo oficial e rejeita a troca do último dígito', () => {
    for (let i = 0; i < 300; i++) {
      const base = String(10_000_000_0000 + i * 7919).padStart(12, '0').slice(0, 12);
      if (/^(\d)\1+$/.test(base)) continue;
      const valido = gerarValido(base);
      expect(validarCNPJ(valido).valido).toBe(true);
      const adulterado = valido.slice(0, 13) + ((Number(valido[13]) + 1) % 10);
      expect(validarCNPJ(adulterado).valido).toBe(false);
    }
  });
});

describe('normalizarCNPJ', () => {
  it('mantém somente os dígitos', () => {
    expect(normalizarCNPJ('11.222.333/0001-81')).toBe('11222333000181');
    expect(normalizarCNPJ('11222333000181')).toBe('11222333000181');
  });
});
