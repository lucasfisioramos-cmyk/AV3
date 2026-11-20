import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../../src/persistence/prisma.js';
import { ContratoRepository } from '../../../src/repositories/contrato.repository.js';
import { OrganizacaoRepository } from '../../../src/repositories/organizacao.repository.js';
import { ConflictError } from '../../../src/errors/app-error.js';

describe('Integração PostgreSQL Real — Módulo Contrato e Partial Unique Index (TASK-09 / N4)', () => {
  let organizacaoId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.contrato.deleteMany();
    await prisma.organizacao.deleteMany();

    const org = await OrganizacaoRepository.create({
      razaoSocial: 'Org Teste Contratos LTDA',
      cnpj: '11222333000181',
      enderecoCompleto: 'Rua Teste Contratos, 100',
      telefone: '12999999999',
      email: 'contato@orgcontratos.com',
    });
    organizacaoId = org.id;
  });

  afterAll(async () => {
    await prisma.contrato.deleteMany();
    await prisma.organizacao.deleteMany();
    await prisma.$disconnect();
  });

  it('deve criar contrato no PostgreSQL com clausulas em formato Json e ativo por padrão', async () => {
    const agora = new Date();
    const vencimento = new Date(agora.getTime() + 365 * 24 * 3600 * 1000);

    const contrato = await ContratoRepository.create({
      organizacaoId,
      dataAssinatura: agora,
      dataVencimento: vencimento,
      clausulas: ['Clausula A', 'Clausula B'],
      valorMensal: 3200,
    });

    expect(contrato.id).toBeDefined();
    expect(contrato.ativo).toBe(true);
    expect(contrato.clausulas).toEqual(['Clausula A', 'Clausula B']);

    const detalheOrg = await OrganizacaoRepository.findDetalheById(organizacaoId);
    expect(detalheOrg?.contratoVigente?.id).toBe(contrato.id);
  });

  it('deve bloquear segundo contrato ativo via partial unique index do PostgreSQL (409 ConflictError)', async () => {
    const agora = new Date();
    const vencimento = new Date(agora.getTime() + 365 * 24 * 3600 * 1000);

    await ContratoRepository.create({
      organizacaoId,
      dataAssinatura: agora,
      dataVencimento: vencimento,
      clausulas: ['Clausula 1'],
      valorMensal: 1000,
    });

    // Tentativa concorrente ou consecutiva de criar outro ativo
    await expect(
      ContratoRepository.create({
        organizacaoId,
        dataAssinatura: agora,
        dataVencimento: vencimento,
        clausulas: ['Clausula 2'],
        valorMensal: 2000,
      })
    ).rejects.toThrow(ConflictError);
  });

  it('deve permitir novo contrato ativo quando o contrato anterior foi desativado (histórico)', async () => {
    const agora = new Date();
    const vencimento = new Date(agora.getTime() + 180 * 24 * 3600 * 1000);

    const contrato1 = await ContratoRepository.create({
      organizacaoId,
      dataAssinatura: agora,
      dataVencimento: vencimento,
      clausulas: ['Clausula Antiga'],
      valorMensal: 1000,
    });

    // Desativa contrato1
    await ContratoRepository.desativar(contrato1.id);

    // Agora pode criar contrato2 ativo
    const contrato2 = await ContratoRepository.create({
      organizacaoId,
      dataAssinatura: agora,
      dataVencimento: new Date(agora.getTime() + 365 * 24 * 3600 * 1000),
      clausulas: ['Clausula Nova'],
      valorMensal: 2000,
    });

    expect(contrato2.ativo).toBe(true);

    const historico = await ContratoRepository.findAllByOrganizacaoId(organizacaoId);
    expect(historico.length).toBe(2);

    const vigente = await ContratoRepository.findVigenteByOrganizacaoId(organizacaoId);
    expect(vigente?.id).toBe(contrato2.id);
  });
});
