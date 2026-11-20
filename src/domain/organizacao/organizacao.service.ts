import { OrganizacaoRepository } from '../../repositories/organizacao.repository.js';
import { exigirEncontrado } from '../shared/guards.js';
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

export interface EditarOrganizacaoInput {
  razaoSocial?: string;
  enderecoCompleto?: string;
  telefone?: string;
  email?: string;
}

export interface ListarOrganizacoesInput {
  ativo?: boolean;
  cnpj?: string;
  razaoSocial?: string;
  page?: number;
  limit?: number;
}

export class OrganizacaoService {
  static async listarTodas(params: ListarOrganizacoesInput = {}) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const filtro = {
      ativo: params.ativo,
      cnpj: params.cnpj,
      razaoSocial: params.razaoSocial,
      skip,
      take: limit,
    };

    const [itens, total] = await Promise.all([
      OrganizacaoRepository.findAll(filtro),
      OrganizacaoRepository.count({
        ativo: params.ativo,
        cnpj: params.cnpj,
        razaoSocial: params.razaoSocial,
      }),
    ]);

    return { itens, total, page, limit };
  }

  static async buscarPorId(id: string) {
    return exigirEncontrado(
      await OrganizacaoRepository.findDetalheById(id),
      'Organização não encontrada.'
    );
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

  static async editarOrganizacao(id: string, data: EditarOrganizacaoInput) {
    exigirEncontrado(
      await OrganizacaoRepository.findById(id),
      'Organização não encontrada.'
    );

    if (data.email) {
      OrganizacaoRules.exigirEmailValido(data.email);
    }

    return OrganizacaoRepository.update(id, data);
  }

  static async desativarOrganizacao(id: string) {
    const org = exigirEncontrado(
      await OrganizacaoRepository.findById(id),
      'Organização não encontrada.'
    );

    OrganizacaoRules.exigirPodeDesativar(org);

    return OrganizacaoRepository.update(id, { ativo: false });
  }
}
