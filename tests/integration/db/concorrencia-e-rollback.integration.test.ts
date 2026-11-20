import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../../src/persistence/prisma.js';
import { LoteService } from '../../../src/domain/lote/lote.service.js';
import { EquipamentoService } from '../../../src/domain/equipamento/equipamento.service.js';
import { UsuarioService } from '../../../src/domain/usuario/usuario.service.js';
import { ConflictError, RegraDeNegocioError } from '../../../src/errors/app-error.js';
import {
  PapelUsuario,
  StatusRastreamento,
  TipoEquipamento,
  EstadoFisico,
} from '../../../src/domain/shared/enums.js';
import { Prisma } from '@prisma/client';

describe('Integração PostgreSQL Real — Concorrência, Constraints e Rollback', () => {
  let organizacaoId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.movimentacao.deleteMany();
    await prisma.equipamento.deleteMany();
    await prisma.lote.deleteMany();
    await prisma.organizacao.deleteMany();
    await prisma.usuario.deleteMany();

    const org = await prisma.organizacao.create({
      data: {
        razaoSocial: 'Org Teste Concorrência LTDA',
        cnpj: '11222333000181',
        enderecoCompleto: 'Rua Teste Concorrência, 100',
        telefone: '12999999999',
        email: 'contato@orgconcorrencia.com',
        ativo: true,
      },
    });
    organizacaoId = org.id;
  });

  afterAll(async () => {
    await prisma.movimentacao.deleteMany();
    await prisma.equipamento.deleteMany();
    await prisma.lote.deleteMany();
    await prisma.organizacao.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.$disconnect();
  });

  // 1. Constraint única concorrente (TASK-02 / Q1)
  it('deve bloquear criação simultânea de lotes com mesma nota fiscal na mesma organização (409 via ConflictError)', async () => {
    const payload = {
      organizacaoId,
      notaFiscal: 'NF-CONCORRENTE-001',
      transportadora: 'Transp Rápida',
    };

    const resultados = await Promise.allSettled([
      LoteService.criarLote(payload),
      LoteService.criarLote(payload),
    ]);

    const sucessos = resultados.filter((r) => r.status === 'fulfilled');
    const falhas = resultados.filter((r) => r.status === 'rejected');

    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(1);
    expect((falhas[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    const totalLotes = await prisma.lote.count({
      where: { organizacaoId, notaFiscal: 'NF-CONCORRENTE-001' },
    });
    expect(totalLotes).toBe(1);
  });

  // 2. Concorrência otimista (version) com Rollback Atômico (TASK-04 / Q1)
  it('deve executar rollback atômico em conflito de concorrência otimista (version) sem deixar movimentação órfã', async () => {
    const lote = await LoteService.criarLote({
      organizacaoId,
      notaFiscal: 'NF-OPTIMISTIC-001',
      transportadora: 'Transp Segura',
    });

    const equipamento = await EquipamentoService.criarEquipamento({
      loteId: lote.id,
      tipo: TipoEquipamento.NOTEBOOK,
      marca: 'Dell',
      modelo: 'Latitude 5420',
      anoFabricacao: 2022,
      estadoFisico: EstadoFisico.BOM_ESTADO,
      pesoQuilogramas: 2.1,
    });

    expect(equipamento.version).toBe(1);

    // Ambas as movimentações tentam avançar o equipamento a partir da versão 1
    const resultados = await Promise.allSettled([
      EquipamentoService.movimentarEquipamento({
        id: equipamento.id,
        novoStatus: StatusRastreamento.EM_TRIAGEM,
        origem: 'Recepção',
        destino: 'Bancada 1',
        responsavel: 'Operador 1',
        version: 1,
      }),
      EquipamentoService.movimentarEquipamento({
        id: equipamento.id,
        novoStatus: StatusRastreamento.EM_TRIAGEM,
        origem: 'Recepção',
        destino: 'Bancada 2',
        responsavel: 'Operador 2',
        version: 1,
      }),
    ]);

    const sucessos = resultados.filter((r) => r.status === 'fulfilled');
    const falhas = resultados.filter((r) => r.status === 'rejected');

    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(1);
    expect((falhas[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);

    // Validação de integridade e rollback no banco real
    const equipamentoFinal = await prisma.equipamento.findUnique({
      where: { id: equipamento.id },
    });
    expect(equipamentoFinal?.version).toBe(2);

    const movimentacoes = await prisma.movimentacao.findMany({
      where: { equipamentoId: equipamento.id },
    });
    // Rollback atômico: a transação rejeitada não gravou registro em movimentacoes
    expect(movimentacoes).toHaveLength(1);
  });

  // 3. Isolamento Serializable com Rollback e proteção de invariante (TASK-04 / Q1)
  it('deve garantir rollback em isolamento Serializable protegendo a regra do último administrador contra race conditions', async () => {
    const admin1 = await prisma.usuario.create({
      data: {
        usuario: 'admin_alpha',
        hashSenha: '$2b$12$e/testehashparaconcorrencia123456789012345678901234567890',
        papel: PapelUsuario.ADMINISTRADOR,
      },
    });

    const admin2 = await prisma.usuario.create({
      data: {
        usuario: 'admin_beta',
        hashSenha: '$2b$12$e/testehashparaconcorrencia123456789012345678901234567890',
        papel: PapelUsuario.ADMINISTRADOR,
      },
    });

    const totalAdminsInicial = await prisma.usuario.count({
      where: { papel: PapelUsuario.ADMINISTRADOR },
    });
    expect(totalAdminsInicial).toBe(2);

    // Dois administradores tentam rebaixar um ao outro simultaneamente
    const resultados = await Promise.allSettled([
      UsuarioService.editarUsuario({
        idUsuarioExecuto: admin1.id,
        idUsuarioAlvo: admin2.id,
        novoPapel: PapelUsuario.OPERADOR_CADASTRO,
      }),
      UsuarioService.editarUsuario({
        idUsuarioExecuto: admin2.id,
        idUsuarioAlvo: admin1.id,
        novoPapel: PapelUsuario.OPERADOR_CADASTRO,
      }),
    ]);

    const falhas = resultados.filter((r) => r.status === 'rejected');
    // Pelo menos uma transação deve falhar (por conflito de serialização P2034 ou RegraDeNegocioError de último admin)
    expect(falhas.length).toBeGreaterThanOrEqual(1);

    for (const falha of falhas) {
      const motivo = (falha as PromiseRejectedResult).reason;
      const ehErroEsperado =
        motivo instanceof RegraDeNegocioError ||
        (motivo instanceof Prisma.PrismaClientKnownRequestError && motivo.code === 'P2034');
      expect(ehErroEsperado).toBe(true);
    }

    // Invariante de sistema protegida pelo rollback: NUNCA ficamos com 0 administradores
    const adminsRestantes = await prisma.usuario.count({
      where: { papel: PapelUsuario.ADMINISTRADOR },
    });
    expect(adminsRestantes).toBeGreaterThanOrEqual(1);
  });
});
