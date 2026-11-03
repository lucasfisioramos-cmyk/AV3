import { ConflictError } from '../../errors/app-error.js';
import { exigirValido } from '../shared/guards.js';
import { validarCNPJ, validarEmail } from '../validators/index.js';

export const OrganizacaoRules = {
  exigirCnpjValido(cnpj: string): void {
    exigirValido(validarCNPJ(cnpj), (motivo) => `O CNPJ informado ("${cnpj}") é inválido. ${motivo}`);
  },

  exigirEmailValido(email: string): void {
    exigirValido(validarEmail(email));
  },

  garantirCnpjDisponivel(cnpj: string, existente: unknown): void {
    if (existente) throw new ConflictError(`Já existe uma organização cadastrada com o CNPJ ${cnpj}.`);
  },
};
