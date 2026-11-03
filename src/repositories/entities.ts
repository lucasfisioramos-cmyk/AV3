import type {
  EstadoFisico,
  PapelUsuario,
  StatusLote,
  StatusRastreamento,
  TipoEquipamento,
} from '../domain/shared/enums.js';

/**
 * Entidades vistas pelo restante da aplicação. São tipos próprios (não os modelos do Prisma):
 * assim o domínio não depende do Prisma e dados sensíveis nunca fazem parte destes tipos.
 */

/** Usuário SEM dados de credencial (hashSenha/salt nunca saem do repositório por padrão). */
export interface Usuario {
  id: string;
  usuario: string;
  papel: PapelUsuario;
  ultimoAcesso: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organizacao {
  id: string;
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string | null;
  enderecoCompleto: string;
  telefone: string;
  email: string;
  dataCadastro: Date;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type OrganizacaoResumo = Pick<Organizacao, 'id' | 'razaoSocial' | 'cnpj'>;

export interface Lote {
  id: string;
  dataEntrada: Date;
  organizacaoId: string;
  notaFiscal: string;
  transportadora: string;
  statusProcessamento: StatusLote;
  observacoes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Equipamento {
  id: string;
  codigoBarrasInterno: string;
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  estadoFisico: EstadoFisico;
  pesoQuilogramas: number;
  loteId: string;
  posicaoNoLote: number;
  statusRastreamento: StatusRastreamento;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Movimentacao {
  id: string;
  equipamentoId: string;
  dataHora: Date;
  origem: string;
  destino: string;
  responsavel: string;
  observacao: string | null;
  createdAt: Date;
}
