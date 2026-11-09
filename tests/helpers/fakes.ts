/**
 * Banco em memória para os testes. Implementa os MESMOS contratos dos repositórios reais
 * (src/repositories/*) e simula transações com snapshot/rollback, então serviços, regras,
 * rotas, JWT e handler de erros rodam de verdade, só a persistência é substituída.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PasswordHasher } from '../../src/security/hasher.js';
import type { PapelUsuario, StatusLote, StatusRastreamento } from '../../src/domain/shared/enums.js';
import type { Equipamento, Lote, Movimentacao, Organizacao, Usuario } from '../../src/repositories/entities.js';
import type { EquipamentoRepository } from '../../src/repositories/equipamento.repository.js';
import type { LoteRepository } from '../../src/repositories/lote.repository.js';
import type { OrganizacaoRepository } from '../../src/repositories/organizacao.repository.js';
import type { RelatorioRepository } from '../../src/repositories/relatorio.repository.js';
import type { UsuarioRepository } from '../../src/repositories/usuario.repository.js';

export const SENHA_TESTE = 'Senha#Forte1';

type UsuarioRow = Usuario & { hashSenha: string };

const erroPrisma = (code: string, meta?: Record<string, unknown>) =>
  new PrismaClientKnownRequestError(`erro simulado ${code}`, { code, clientVersion: 'teste', meta });

let hashSenhaTeste: Promise<string> | undefined;
/** Hash (bcrypt real) de SENHA_TESTE, calculado uma única vez por arquivo de teste. */
export const obterHashSenhaTeste = () => (hashSenhaTeste ??= PasswordHasher.hashPassword(SENHA_TESTE));

class BancoEmMemoria {
  usuarios = new Map<string, UsuarioRow>();
  organizacoes = new Map<string, Organizacao>();
  lotes = new Map<string, Lote>();
  equipamentos = new Map<string, Equipamento>();
  movimentacoes = new Map<string, Movimentacao>();

  /** Opções de cada transação executada (permite verificar o isolamento usado). */
  transacoes: { isolamento?: string }[] = [];

  reset() {
    for (const tabela of this.tabelas()) tabela.clear();
    this.transacoes = [];
  }

  private tabelas() {
    return [this.usuarios, this.organizacoes, this.lotes, this.equipamentos, this.movimentacoes] as Map<string, unknown>[];
  }

  /** Executa `fn` de forma atômica: qualquer erro restaura o estado anterior (rollback). */
  async transacao<T>(fn: (tx: object) => Promise<T>, opcoes: { isolamento?: string } = {}): Promise<T> {
    this.transacoes.push(opcoes);
    const copia = this.tabelas().map((t) => structuredClone(t));
    try {
      return await fn({ __tx: true });
    } catch (erro) {
      this.tabelas().forEach((tabela, i) => {
        tabela.clear();
        for (const [k, v] of copia[i]) tabela.set(k, v);
      });
      throw erro;
    }
  }

  // ---------- Repositórios (mesmos contratos dos reais) ----------

  usuarioRepository: UsuarioRepository = {
    findById: async (id) => this.publico(this.usuarios.get(id)),
    findAll: async (filtro) => [...this.usuarios.values()].filter((u) => !filtro?.papel || u.papel === filtro.papel).map((u) => this.publico(u)!),
    findByUsuario: async (usuario) => this.publico([...this.usuarios.values()].find((u) => u.usuario === usuario)),
    findCredencialByUsuario: async (usuario) => {
      const u = [...this.usuarios.values()].find((x) => x.usuario === usuario);
      return u ? { id: u.id, usuario: u.usuario, papel: u.papel, hashSenha: u.hashSenha } : null;
    },
    create: async (data) => {
      if ([...this.usuarios.values()].some((u) => u.usuario === data.usuario)) throw erroPrisma('P2002', { target: ['usuario'] });
      const agora = new Date();
      const row: UsuarioRow = { id: randomUUID(), ultimoAcesso: null, createdAt: agora, updatedAt: agora, ...data };
      this.usuarios.set(row.id, row);
      return this.publico(row)!;
    },
    update: async (id, data) => {
      const atual = this.usuarios.get(id);
      if (!atual) throw erroPrisma('P2025');
      const novo = { ...atual, ...data, updatedAt: new Date() };
      this.usuarios.set(id, novo);
      return this.publico(novo)!;
    },
    delete: async (id) => {
      if (!this.usuarios.delete(id)) throw erroPrisma('P2025');
    },
    count: async (filtro) => [...this.usuarios.values()].filter((u) => !filtro?.papel || u.papel === filtro.papel).length,
  };

  organizacaoRepository: OrganizacaoRepository = {
    findById: async (id) => this.organizacoes.get(id) ?? null,
    findAll: async (filtro) => [...this.organizacoes.values()].filter((o) => filtro?.ativo === undefined || o.ativo === filtro.ativo),
    findByCnpj: async (cnpj) => [...this.organizacoes.values()].find((o) => o.cnpj === cnpj) ?? null,
    create: async (data) => {
      if ([...this.organizacoes.values()].some((o) => o.cnpj === data.cnpj)) throw erroPrisma('P2002', { target: ['cnpj'] });
      const agora = new Date();
      const org: Organizacao = { id: randomUUID(), inscricaoEstadual: null, dataCadastro: agora, ativo: true, createdAt: agora, updatedAt: agora, ...data };
      this.organizacoes.set(org.id, org);
      return org;
    },
    update: async (id, data) => {
      const atual = this.organizacoes.get(id);
      if (!atual) throw erroPrisma('P2025');
      const novo = { ...atual, ...data, updatedAt: new Date() } as Organizacao;
      this.organizacoes.set(id, novo);
      return novo;
    },
    delete: async (id) => {
      if (!this.organizacoes.delete(id)) throw erroPrisma('P2025');
    },
    count: async (filtro) => [...this.organizacoes.values()].filter((o) => filtro?.ativo === undefined || o.ativo === filtro.ativo).length,
  };

  loteRepository: LoteRepository = {
    findById: async (id) => this.lotes.get(id) ?? null,
    findAll: async (filtro) => [...this.lotes.values()].filter((l) => this.casaLote(l, filtro)),
    listarComResumo: async (filtro) =>
      [...this.lotes.values()]
        .filter((l) => this.casaLote(l, filtro))
        .map((l) => ({
          ...l,
          organizacao: this.resumoOrg(l.organizacaoId),
          totalEquipamentos: [...this.equipamentos.values()].filter((e) => e.loteId === l.id).length,
        })),
    findDetalheById: async (id) => {
      const lote = this.lotes.get(id);
      if (!lote) return null;
      const equipamentos = [...this.equipamentos.values()].filter((e) => e.loteId === id).sort((a, b) => a.posicaoNoLote - b.posicaoNoLote);
      return { ...lote, organizacao: this.resumoOrg(lote.organizacaoId), equipamentos };
    },
    findByNotaFiscalEOrganizacao: async (notaFiscal, organizacaoId) =>
      [...this.lotes.values()].find((l) => l.notaFiscal === notaFiscal && l.organizacaoId === organizacaoId) ?? null,
    create: async (data) => {
      const agora = new Date();
      const lote: Lote = {
        id: randomUUID(),
        dataEntrada: data.dataEntrada ?? agora,
        organizacaoId: data.organizacaoId,
        notaFiscal: data.notaFiscal,
        transportadora: data.transportadora,
        statusProcessamento: data.statusProcessamento ?? 'RECEBIDO',
        observacoes: data.observacoes ?? null,
        version: 1,
        createdAt: agora,
        updatedAt: agora,
      };
      this.lotes.set(lote.id, lote);
      return lote;
    },
    update: async (id, data) => {
      const atual = this.lotes.get(id);
      if (!atual) throw erroPrisma('P2025');
      const novo = { ...atual, ...data, updatedAt: new Date() } as Lote;
      this.lotes.set(id, novo);
      return novo;
    },
    delete: async (id) => {
      if (!this.lotes.delete(id)) throw erroPrisma('P2025');
    },
    count: async (filtro) => [...this.lotes.values()].filter((l) => this.casaLote(l, filtro)).length,
  };

  equipamentoRepository: EquipamentoRepository = {
    findById: async (id) => this.equipamentos.get(id) ?? null,
    findAll: async (filtro) => [...this.equipamentos.values()].filter((e) => this.casaEquip(e, filtro)),
    findDetalheByIdentificador: async (identificador) => {
      const e = [...this.equipamentos.values()].find((x) => x.id === identificador || x.codigoBarrasInterno === identificador);
      if (!e) return null;
      const lote = this.lotes.get(e.loteId)!;
      return {
        ...e,
        lote: { ...lote, organizacao: this.resumoOrg(lote.organizacaoId) },
        historicoMovimentacao: [...this.movimentacoes.values()].filter((m) => m.equipamentoId === e.id),
      };
    },
    create: async (data) => {
      if ([...this.equipamentos.values()].some((e) => e.codigoBarrasInterno === data.codigoBarrasInterno)) {
        throw erroPrisma('P2002', { target: ['codigoBarrasInterno'] });
      }
      const agora = new Date();
      const equip: Equipamento = { id: randomUUID(), version: 1, createdAt: agora, updatedAt: agora, ...data };
      this.equipamentos.set(equip.id, equip);
      return equip;
    },
    update: async (id, data) => {
      const atual = this.equipamentos.get(id);
      if (!atual) throw erroPrisma('P2025');
      const novo = { ...atual, ...data, updatedAt: new Date() } as Equipamento;
      this.equipamentos.set(id, novo);
      return novo;
    },
    atualizarComVersao: async (id, versaoAtual, data) => {
      const atual = this.equipamentos.get(id);
      if (!atual || atual.version !== versaoAtual) return null;
      const novo = { ...atual, ...data, version: atual.version + 1, updatedAt: new Date() } as Equipamento;
      this.equipamentos.set(id, novo);
      return novo;
    },
    delete: async (id) => {
      if (!this.equipamentos.delete(id)) throw erroPrisma('P2025');
    },
    count: async (filtro) => [...this.equipamentos.values()].filter((e) => this.casaEquip(e, filtro)).length,
    registrarMovimentacao: async (data) => {
      const agora = new Date();
      const mov: Movimentacao = { id: randomUUID(), dataHora: agora, createdAt: agora, ...data, observacao: data.observacao ?? null };
      this.movimentacoes.set(mov.id, mov);
      return mov;
    },
  };

  relatorioRepository: RelatorioRepository = {
    contarEquipamentosPorStatus: async () => {
      const contagem = new Map<StatusRastreamento, number>();
      for (const e of this.equipamentos.values()) contagem.set(e.statusRastreamento, (contagem.get(e.statusRastreamento) ?? 0) + 1);
      return [...contagem].map(([statusRastreamento, total]) => ({ statusRastreamento, total }));
    },
    obterMetricasGerais: async () => this.metricas([...this.equipamentos.values()]),
    obterMetricasPorOrganizacao: async (organizacaoId) =>
      this.metricas([...this.equipamentos.values()].filter((e) => this.lotes.get(e.loteId)?.organizacaoId === organizacaoId)),
  };

  // ---------- Dados de teste ----------

  semear = {
    usuario: async (dados: { usuario?: string; papel?: PapelUsuario; hashSenha?: string } = {}): Promise<Usuario> => {
      const hashSenha = dados.hashSenha ?? (await obterHashSenhaTeste());
      return this.usuarioRepository.create({
        usuario: dados.usuario ?? `usuario-${randomUUID().slice(0, 8)}`,
        papel: dados.papel ?? 'OPERADOR_CADASTRO',
        hashSenha,
      });
    },
    organizacao: async (dados: Partial<Organizacao> = {}) =>
      this.organizacaoRepository.create({
        razaoSocial: 'Recicla Tech Ltda',
        cnpj: '11222333000181',
        enderecoCompleto: 'Rua das Flores, 100',
        telefone: '11999990000',
        email: 'contato@reciclatech.com',
        ...dados,
      }),
    lote: async (organizacaoId: string, dados: { statusProcessamento?: StatusLote; notaFiscal?: string } = {}) =>
      this.loteRepository.create({
        organizacaoId,
        notaFiscal: dados.notaFiscal ?? `NF-${randomUUID().slice(0, 6)}`,
        transportadora: 'Transportes Verde',
        statusProcessamento: dados.statusProcessamento,
      }),
    equipamento: async (loteId: string, dados: Partial<Equipamento> = {}) => {
      const posicao = await this.equipamentoRepository.count({ loteId });
      return this.equipamentoRepository.create({
        loteId,
        codigoBarrasInterno: `GC-${loteId.slice(0, 4)}-NOT-${String(posicao + 1).padStart(3, '0')}`,
        tipo: 'NOTEBOOK',
        marca: 'Dell',
        modelo: 'Latitude',
        anoFabricacao: 2020,
        estadoFisico: 'BOM_ESTADO',
        pesoQuilogramas: 2,
        posicaoNoLote: posicao + 1,
        statusRastreamento: 'AGUARDANDO_TRIAGEM',
        ...dados,
      });
    },
  };

  // ---------- internos ----------

  private publico(row: UsuarioRow | undefined): Usuario | null {
    if (!row) return null;
    const { hashSenha: _hash, ...publico } = row;
    return publico;
  }
  private resumoOrg(id: string) {
    const o = this.organizacoes.get(id)!;
    return { id: o.id, razaoSocial: o.razaoSocial, cnpj: o.cnpj };
  }
  private casaLote(l: Lote, f?: { organizacaoId?: string; statusProcessamento?: StatusLote }) {
    return (!f?.organizacaoId || l.organizacaoId === f.organizacaoId) && (!f?.statusProcessamento || l.statusProcessamento === f.statusProcessamento);
  }
  private casaEquip(e: Equipamento, f?: { loteId?: string; statusRastreamento?: StatusRastreamento }) {
    return (!f?.loteId || e.loteId === f.loteId) && (!f?.statusRastreamento || e.statusRastreamento === f.statusRastreamento);
  }
  private metricas(lista: Equipamento[]) {
    return { totalEquipamentos: lista.length, pesoTotalKg: lista.reduce((s, e) => s + e.pesoQuilogramas, 0) };
  }
}

export const db = new BancoEmMemoria();
