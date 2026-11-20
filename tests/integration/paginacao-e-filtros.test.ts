import { afterAll, describe, expect, it } from 'vitest';
import { PapelUsuario, StatusLote, StatusRastreamento, TipoEquipamento } from '../../src/domain/shared/enums.js';
import { autenticado, fecharApp, obterApp } from '../helpers/app.js';
import { db } from '../helpers/fakes.js';

afterAll(fecharApp);

async function chamar(
  url: string,
  quem: Awaited<ReturnType<typeof db.semear.usuario>>
) {
  return (await obterApp()).inject({
    method: 'GET',
    url,
    headers: await autenticado(quem),
  });
}

describe('Paginação e Filtros nas Listagens (TASK-13 / N6)', () => {
  describe('1. Usuários (GET /api/v1/usuarios)', () => {
    it('200: paginação padrão (page=1, limit=20) e estrutura de meta', async () => {
      const admin = await db.semear.usuario({ papel: PapelUsuario.ADMINISTRADOR });
      const res = await chamar('/api/v1/usuarios', admin);

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 20,
          total: expect.any(Number),
          totalPages: expect.any(Number),
        })
      );
      expect(body.meta.totalPages).toBe(Math.ceil(body.meta.total / 20));
    });

    it('200: paginação customizada (?page=2&limit=2)', async () => {
      const admin = await db.semear.usuario({ papel: PapelUsuario.ADMINISTRADOR });
      await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });
      await db.semear.usuario({ papel: PapelUsuario.GESTOR_ALMOXARIFADO });
      await db.semear.usuario({ papel: PapelUsuario.AUDITOR });

      const res = await chamar('/api/v1/usuarios?page=2&limit=2', admin);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.meta.page).toBe(2);
      expect(body.meta.limit).toBe(2);
      expect(body.data.length).toBeLessThanOrEqual(2);
    });

    it('200: filtro por papel (?papel=AUDITOR)', async () => {
      const admin = await db.semear.usuario({ papel: PapelUsuario.ADMINISTRADOR });
      const aud = await db.semear.usuario({ papel: PapelUsuario.AUDITOR });

      const res = await chamar('/api/v1/usuarios?papel=AUDITOR', admin);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      for (const u of body.data) {
        expect(u.papel).toBe(PapelUsuario.AUDITOR);
      }
    });

    it('400: papel inválido retorna validação', async () => {
      const admin = await db.semear.usuario({ papel: PapelUsuario.ADMINISTRADOR });
      const res = await chamar('/api/v1/usuarios?papel=PAPEL_INEXISTENTE', admin);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('2. Organizações (GET /api/v1/organizacoes)', () => {
    it('200: paginação padrão e busca por razaoSocial (parcial case-insensitive)', async () => {
      const op = await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });
      const orgAlfa = await db.semear.organizacao({
        razaoSocial: 'Alfa Reciclagem Sustentável SA',
        cnpj: '11111111000101',
      });
      await db.semear.organizacao({
        razaoSocial: 'Beta Logística Reversa Ltda',
        cnpj: '22222222000102',
      });

      const res = await chamar('/api/v1/organizacoes?razaoSocial=reciclagem', op);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.meta.total).toBeGreaterThanOrEqual(1);
      const encontrada = body.data.find((o: any) => o.id === orgAlfa.id);
      expect(encontrada).toBeDefined();
      for (const o of body.data) {
        expect(o.razaoSocial.toLowerCase()).toContain('reciclagem');
      }
    });

    it('200: filtro por CNPJ e status ativo', async () => {
      const op = await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });
      const cnpjTeste = '33444555000166';
      await db.semear.organizacao({
        razaoSocial: 'Gamma Descarte',
        cnpj: cnpjTeste,
        ativo: true,
      });

      const res = await chamar(`/api/v1/organizacoes?cnpj=${cnpjTeste}&ativo=true`, op);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].cnpj).toBe(cnpjTeste);
      expect(body.data[0].ativo).toBe(true);
    });

    it('200: totalPages retorna 0 quando total é 0', async () => {
      const op = await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });
      const res = await chamar('/api/v1/organizacoes?cnpj=99999999999999', op);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
      expect(body.meta.totalPages).toBe(0);
    });
  });

  describe('3. Lotes (GET /api/v1/lotes)', () => {
    it('200: filtro por organizacaoId e status', async () => {
      const ga = await db.semear.usuario({ papel: PapelUsuario.GESTOR_ALMOXARIFADO });
      const org1 = await db.semear.organizacao({ cnpj: '55666777000188' });
      const org2 = await db.semear.organizacao({ cnpj: '66777888000199' });

      const lote1 = await db.semear.lote(org1.id, { statusProcessamento: StatusLote.RECEBIDO });
      await db.semear.lote(org2.id, { statusProcessamento: StatusLote.RECEBIDO });

      const res = await chamar(`/api/v1/lotes?organizacaoId=${org1.id}&status=RECEBIDO`, ga);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.meta.total).toBeGreaterThanOrEqual(1);
      for (const item of body.data) {
        expect(item.organizacaoId).toBe(org1.id);
        expect(item.statusProcessamento).toBe(StatusLote.RECEBIDO);
        expect(item).toHaveProperty('organizacao');
        expect(item).toHaveProperty('totalEquipamentos');
      }
    });

    it('200: filtro por intervalo de datas (dataEntradaInicio e dataEntradaFim)', async () => {
      const ga = await db.semear.usuario({ papel: PapelUsuario.GESTOR_ALMOXARIFADO });
      const org = await db.semear.organizacao({ cnpj: '77888999000111' });

      const dAntiga = new Date('2026-01-10T10:00:00.000Z');
      const dAlvo = new Date('2026-02-15T10:00:00.000Z');
      const dRecente = new Date('2026-03-20T10:00:00.000Z');

      await db.semear.lote(org.id, { dataEntrada: dAntiga });
      const loteAlvo = await db.semear.lote(org.id, { dataEntrada: dAlvo });
      await db.semear.lote(org.id, { dataEntrada: dRecente });

      const res = await chamar(
        `/api/v1/lotes?organizacaoId=${org.id}&dataEntradaInicio=2026-02-01T00:00:00.000Z&dataEntradaFim=2026-02-28T23:59:59.999Z`,
        ga
      );
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].id).toBe(loteAlvo.id);
    });

    it('400: query com datas inválidas rejeita requisição', async () => {
      const ga = await db.semear.usuario({ papel: PapelUsuario.GESTOR_ALMOXARIFADO });
      const res = await chamar('/api/v1/lotes?dataEntradaInicio=data-invalida', ga);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('4. Equipamentos (GET /api/v1/equipamentos)', () => {
    it('200: todos os papéis autenticados podem listar equipamentos', async () => {
      const papeis = [
        PapelUsuario.ADMINISTRADOR,
        PapelUsuario.OPERADOR_CADASTRO,
        PapelUsuario.GESTOR_ALMOXARIFADO,
        PapelUsuario.AUDITOR,
      ];

      for (const papel of papeis) {
        const u = await db.semear.usuario({ papel });
        const res = await chamar('/api/v1/equipamentos', u);
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body).toHaveProperty('data');
        expect(body).toHaveProperty('meta');
      }
    });

    it('200: filtros por loteId, tipo e statusRastreamento', async () => {
      const op = await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });
      const org = await db.semear.organizacao({ cnpj: '88999000000122' });
      const lote = await db.semear.lote(org.id);

      const eq1 = await db.semear.equipamento(lote.id, {
        tipo: TipoEquipamento.NOTEBOOK,
        statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM,
      });
      await db.semear.equipamento(lote.id, {
        tipo: TipoEquipamento.MONITOR,
        statusRastreamento: StatusRastreamento.AGUARDANDO_TRIAGEM,
      });

      const res = await chamar(
        `/api/v1/equipamentos?loteId=${lote.id}&tipo=NOTEBOOK&statusRastreamento=AGUARDANDO_TRIAGEM`,
        op
      );
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].id).toBe(eq1.id);
      expect(body.data[0].tipo).toBe(TipoEquipamento.NOTEBOOK);
    });

    it('200: paginação personalizada em equipamentos', async () => {
      const op = await db.semear.usuario({ papel: PapelUsuario.OPERADOR_CADASTRO });
      const org = await db.semear.organizacao({ cnpj: '99000111000133' });
      const lote = await db.semear.lote(org.id);

      await db.semear.equipamento(lote.id);
      await db.semear.equipamento(lote.id);
      await db.semear.equipamento(lote.id);

      const res = await chamar(`/api/v1/equipamentos?loteId=${lote.id}&page=1&limit=2`, op);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(2);
      expect(body.meta.total).toBe(3);
      expect(body.meta.totalPages).toBe(2);
      expect(body.data.length).toBe(2);
    });
  });
});
