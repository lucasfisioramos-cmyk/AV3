import { ContratoRepository } from '../../repositories/contrato.repository.js';
import { OrganizacaoRepository } from '../../repositories/organizacao.repository.js';
import { ContratoRules } from './contrato.rules.js';
import { exigirEncontrado } from '../shared/guards.js';
import type { Contrato } from '../../repositories/entities.js';

export interface CriarContratoInput {
  organizacaoId: string;
  dataAssinatura: Date;
  dataVencimento: Date;
  clausulas: string[];
  valorMensal: number;
  renovacaoAutomatica?: boolean;
}

export interface RenovarContratoInput {
  organizacaoId: string;
  novoVencimento: Date;
}

export class ContratoService {
  static async criarContrato(input: CriarContratoInput): Promise<Contrato> {
    const org = exigirEncontrado(
      await OrganizacaoRepository.findById(input.organizacaoId),
      'Organização não encontrada.'
    );

    ContratoRules.garantirOrganizacaoAtiva(org);
    ContratoRules.exigirDatasValidas(input.dataAssinatura, input.dataVencimento);
    ContratoRules.exigirValorMensalValido(input.valorMensal);
    ContratoRules.exigirClausulasValidas(input.clausulas);

    const vigente = await ContratoRepository.findVigenteByOrganizacaoId(input.organizacaoId);
    ContratoRules.garantirSemContratoVigente(vigente);

    return ContratoRepository.create({
      organizacaoId: input.organizacaoId,
      dataAssinatura: input.dataAssinatura,
      dataVencimento: input.dataVencimento,
      clausulas: input.clausulas,
      valorMensal: input.valorMensal,
      renovacaoAutomatica: input.renovacaoAutomatica ?? true,
      ativo: true,
    });
  }

  static async buscarContratoVigente(organizacaoId: string): Promise<Contrato> {
    exigirEncontrado(
      await OrganizacaoRepository.findById(organizacaoId),
      'Organização não encontrada.'
    );

    return exigirEncontrado(
      await ContratoRepository.findVigenteByOrganizacaoId(organizacaoId),
      'A organização não possui contrato vigente.'
    );
  }

  static async listarHistoricoPorOrganizacao(organizacaoId: string): Promise<Contrato[]> {
    exigirEncontrado(
      await OrganizacaoRepository.findById(organizacaoId),
      'Organização não encontrada.'
    );

    return ContratoRepository.findAllByOrganizacaoId(organizacaoId);
  }

  static async renovarContrato(input: RenovarContratoInput): Promise<Contrato> {
    exigirEncontrado(
      await OrganizacaoRepository.findById(input.organizacaoId),
      'Organização não encontrada.'
    );

    const contrato = exigirEncontrado(
      await ContratoRepository.findVigenteByOrganizacaoId(input.organizacaoId),
      'A organização não possui contrato vigente para renovar.'
    );

    ContratoRules.validarRenovacao(contrato, input.novoVencimento);

    return ContratoRepository.update(contrato.id, {
      dataVencimento: input.novoVencimento,
    });
  }

  static async encerrarContratoVigente(organizacaoId: string): Promise<Contrato> {
    exigirEncontrado(
      await OrganizacaoRepository.findById(organizacaoId),
      'Organização não encontrada.'
    );

    const contrato = exigirEncontrado(
      await ContratoRepository.findVigenteByOrganizacaoId(organizacaoId),
      'A organização não possui contrato vigente para encerrar.'
    );

    return ContratoRepository.desativar(contrato.id);
  }
}
