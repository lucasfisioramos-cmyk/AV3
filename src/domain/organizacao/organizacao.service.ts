import { OrganizacaoRepository } from '../../repositories/organizacao.repository.js';
import { normalizarCNPJ } from '../validators/index.js';
import { OrganizacaoRules } from './organizacao.rules.js';

export interface CriarOrganizacaoInput {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual?: string;
  enderecoCompleto: string;
  telefone?: string;
  email: string;
}

export class OrganizacaoService {
  static async listarTodas() {
    return OrganizacaoRepository.findAll();
  }

  // Transação: NÃO. Escrita única; a unicidade do CNPJ também é garantida pela constraint do banco.
  static async criarOrganizacao(data: CriarOrganizacaoInput) {
    OrganizacaoRules.exigirCnpjValido(data.cnpj);
    OrganizacaoRules.exigirEmailValido(data.email);

    // O CNPJ é armazenado somente com dígitos, para que "11.222.333/0001-81" e
    // "11222333000181" sejam reconhecidos como a mesma organização.
    const cnpj = normalizarCNPJ(data.cnpj);

    const cnpjExistente = await OrganizacaoRepository.findByCnpj(cnpj);
    OrganizacaoRules.garantirCnpjDisponivel(data.cnpj, cnpjExistente);

    // Telefone é opcional na API, mas obrigatório na tabela: ausência é gravada como texto vazio.
    return OrganizacaoRepository.create({ ...data, cnpj, telefone: data.telefone ?? '' });
  }
}
