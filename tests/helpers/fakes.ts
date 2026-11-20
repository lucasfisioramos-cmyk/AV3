/**
 * Banco em memória para os testes. Implementa os MESMOS contratos dos repositórios reais
 * (src/repositories/*) e simula transações com snapshot/rollback, então serviços, regras,
 * rotas, JWT e handler de erros rodam de verdade, só a persistência é substituída.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PasswordHasher } from '../../src/security/hasher.js';
import type { PapelUsuario, StatusLote, StatusRastreamento, TipoEquipamento } from '../../src/domain/shared/enums.js';
import type { Contrato, Equipamento, Lote, Movimentacao, Organizacao, OrganizacaoDetalhe, TokenRevogado, Usuario } from '../../src/repositories/entities.js';
import type { ContratoRepository } from '../../src/repositories/contrato.repository.js';
import type { EquipamentoFiltro, EquipamentoRepository } from '../../src/repositories/equipamento.repository.js';
import type { CriarLoteData, LoteFiltro, LoteRepository } from '../../src/repositories/lote.repository.js';
import type { OrganizacaoFiltro, OrganizacaoRepository } from '../../src/repositories/organizacao.repository.js';
import type { RelatorioRepository } from '../../src/repositories/relatorio.repository.js';
import type { TokenRevogadoRepository } from '../../src/repositories/token-revogado.repository.js';
import type { UsuarioFiltro, UsuarioRepository } from '../../src/repositories/usuario.repository.js';

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
  contratos = new Map<string, Contrato>();
  lotes = new Map<string, Lote>();
  equipamentos = new Map<string, Equipamento>();
  movimentacoes = new Map<string, Movimentacao>();
  tokensRevogados = new Map<string, TokenRevogado>();

  /** Opções de cada transação executada (permite verificar o isolamento usado). */
  transacoes: { isolamento?: string }[] = [];

  reset() {
    for (const tabela of this.tabelas()) tabela.clear();
    this.transacoes = [];
  }

  private tabelas() {
    return [this.usuarios, this.organizacoes, this.contratos, this.lotes, this.equipamentos, this.movimentacoes, this.tokensRevogados] as Map<string, unknown>[];
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
    findAll: async (filtro) =>
      this.paginar(
        [...this.usuarios.values()].filter((u) => !filtro?.papel || u.papel === filtro.papel).map((u) => this.publico(u)!),
        filtro
      ),
    findByUsuario: async (usuario) => this.publico([...this.usuarios.values()].find((u) => u.usuario === usuario)),
    findCredencialByUsuario: async (usuario) => {
      const u = [...this.usuarios.values()].find((x) => x.usuario === usuario);
      return u ? { id: u.id, usuario: u.usuario, papel: u.papel, hashSenha: u.hashSenha } : null;
    },
    findCredencialById: async (id) => {
      const u = this.usuarios.get(id);
      return u ? { id: u.id, usuario: u.usuario, papel: u.papel, hashSenha: u.hashSenha } : null;
    },
    create: async (data) => {
      if ([...this.usuarios.values()].some((u) => u.usuario === data.usuario)) throw erroPrisma('P2002', { target: ['usuario'] });
      const agora = new Date();
      const row: UsuarioRow = { id: randomUUID(), ultimoAcesso: null, tokensValidosApos: null, createdAt: agora, updatedAt: agora, ...data };
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

  tokenRevogadoRepository: TokenRevogadoRepository = {
    criar: async (data) => {
      const agora = new Date();
      const item: TokenRevogado = { ...data, createdAt: agora };
      this.tokensRevogados.set(item.jti, item);
      return item;
    },
    findByJti: async (jti) => this.tokensRevogados.get(jti) ?? null,
    isRevogado: async (jti) => this.tokensRevogados.has(jti),
    limparExpirados: async (dataReferencia = new Date()) => {
      let removidos = 0;
      for (const [jti, item] of this.tokensRevogados.entries()) {
        if (item.expiresAt < dataReferencia) {
          this.tokensRevogados.delete(jti);
          removidos++;
        }
      }
      return removidos;
    },
  };

  organizacaoRepository: OrganizacaoRepository = {
    findById: async (id) => this.organizacoes.get(id) ?? null,
    findDetalheById: async (id) => {
      const org = this.organizacoes.get(id);
      if (!org) return null;
      const contrato = [...this.contratos.values()].find((c) => c.organizacaoId === id && c.ativo) ?? null;
      return { ...org, contratoVigente: contrato };
    },
    findAll: async (filtro) => this.paginar([...this.organizacoes.values()].filter((o) => this.casaOrg(o, filtro)), filtro),
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
    count: async (filtro) => [...this.organizacoes.values()].filter((o) => this.casaOrg(o, filtro)).length,
  };

  contratoRepository: ContratoRepository = {
    findById: async (id) => this.contratos.get(id) ?? null,
    findVigenteByOrganizacaoId: async (organizacaoId) =>
      [...this.contratos.values()].find((c) => c.organizacaoId === organizacaoId && c.ativo) ?? null,
    findAllByOrganizacaoId: async (organizacaoId) =>
      [...this.contratos.values()].filter((c) => c.organizacaoId === organizacaoId),
    create: async (data) => {
      const ativo = data.ativo ?? true;
      if (ativo && [...this.contratos.values()].some((c) => c.organizacaoId === data.organizacaoId && c.ativo)) {
        throw erroPrisma('P2002', { target: ['organizacaoId', 'ativo'] });
      }
      const agora = new Date();
      const c: Contrato = {
        id: randomUUID(),
        renovacaoAutomatica: data.renovacaoAutomatica ?? true,
        ativo,
        createdAt: agora,
        updatedAt: agora,
        ...data,
      };
      this.contratos.set(c.id, c);
      return c;
    },
    update: async (id, data) => {
      const atual = this.contratos.get(id);
      if (!atual) throw erroPrisma('P2025');
      const novo: Contrato = { ...atual, ...data, updatedAt: new Date() };
      this.contratos.set(id, novo);
      return novo;
    },
    desativar: async (id) => {
      return this.contratoRepository.update(id, { ativo: false });
    },
  };

  loteRepository: LoteRepository = {
    findById: async (id) => this.lotes.get(id) ?? null,
    findAll: async (filtro) => this.paginar([...this.lotes.values()].filter((l) => this.casaLote(l, filtro)), filtro),
    listarComResumo: async (filtro) =>
      this.paginar(
        [...this.lotes.values()]
          .filter((l) => this.casaLote(l, filtro))
          .map((l) => ({
            ...l,
            organizacao: this.resumoOrg(l.organizacaoId),
            totalEquipamentos: [...this.equipamentos.values()].filter((e) => e.loteId === l.id).length,
          })),
        filtro
      ),
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
    findAll: async (filtro) => this.paginar([...this.equipamentos.values()].filter((e) => this.casaEquip(e, filtro)), filtro),
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
    contarMovimentacoes: async (equipamentoId) =>
      [...this.movimentacoes.values()].filter((m) => m.equipamentoId === equipamentoId).length,
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
    contrato: async (organizacaoId: string, dados: Partial<Contrato> = {}) => {
      const agora = new Date();
      return this.contratoRepository.create({
        organizacaoId,
        dataAssinatura: dados.dataAssinatura ?? agora,
        dataVencimento: dados.dataVencimento ?? new Date(agora.getTime() + 365 * 24 * 3600 * 1000),
        clausulas: dados.clausulas ?? ['Cláusula padrão de reciclagem e tratamento de resíduos.'],
        valorMensal: dados.valorMensal ?? 1500.0,
        renovacaoAutomatica: dados.renovacaoAutomatica ?? true,
        ativo: dados.ativo ?? true,
      });
    },
    lote: async (organizacaoId: string, dados: Partial<CriarLoteData> = {}) =>
      this.loteRepository.create({
        organizacaoId,
        notaFiscal: dados.notaFiscal ?? `NF-${randomUUID().slice(0, 6)}`,
        transportadora: dados.transportadora ?? 'Transportes Verde',
        statusProcessamento: dados.statusProcessamento,
        observacoes: dados.observacoes,
        dataEntrada: dados.dataEntrada,
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
  private paginar<T>(items: T[], f?: { skip?: number; take?: number }): T[] {
    const skip = f?.skip ?? 0;
    const take = f?.take;
    return take !== undefined ? items.slice(skip, skip + take) : items.slice(skip);
  }
  private casaOrg(o: Organizacao, f?: OrganizacaoFiltro) {
    if (f?.ativo !== undefined && o.ativo !== f.ativo) return false;
    if (f?.cnpj && !o.cnpj.includes(f.cnpj)) return false;
    if (f?.razaoSocial && !o.razaoSocial.toLowerCase().includes(f.razaoSocial.toLowerCase())) return false;
    return true;
  }
  private casaLote(l: Lote, f?: LoteFiltro) {
    if (f?.organizacaoId && l.organizacaoId !== f.organizacaoId) return false;
    if (f?.statusProcessamento && l.statusProcessamento !== f.statusProcessamento) return false;
    if (f?.dataEntradaInicio && l.dataEntrada < f.dataEntradaInicio) return false;
    if (f?.dataEntradaFim && l.dataEntrada > f.dataEntradaFim) return false;
    return true;
  }
  private casaEquip(e: Equipamento, f?: EquipamentoFiltro) {
    if (f?.loteId && e.loteId !== f.loteId) return false;
    if (f?.statusRastreamento && e.statusRastreamento !== f.statusRastreamento) return false;
    if (f?.tipo && e.tipo !== f.tipo) return false;
    return true;
  }
  private metricas(lista: Equipamento[]) {
    return { totalEquipamentos: lista.length, pesoTotalKg: lista.reduce((s, e) => s + e.pesoQuilogramas, 0) };
  }
}

export const db = new BancoEmMemoria();
