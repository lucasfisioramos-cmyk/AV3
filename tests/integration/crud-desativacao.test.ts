import { afterAll, describe, expect, it } from 'vitest';
import { autenticado, fecharApp, obterApp } from '../helpers/app.js';
import { db } from '../helpers/fakes.js';

afterAll(fecharApp);

async function chamar(
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  quem: Awaited<ReturnType<typeof db.semear.usuario>>,
  corpo?: object
) {
  return (await obterApp()).inject({
    method: metodo,
    url,
    headers: await autenticado(quem),
    payload: corpo,
  });
}

describe('CRUD e Desativação de Entidades (TASK-12 / N5)', () => {
  describe('1. Usuários — Listagem (GET /api/v1/usuarios)', () => {
    it('200: ADMINISTRADOR lista todos os usuários sem expor hashSenha', async () => {
      const admin = await db.semear.usuario({ papel: 'ADMINISTRADOR' });
      await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
      await db.semear.usuario({ papel: 'GESTOR_ALMOXARIFADO' });

      const res = await chamar('GET', '/api/v1/usuarios', admin);
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(3);
      expect(body.meta.total).toBe(body.data.length);

      // Garante que nenhum usuário expõe hashSenha
      for (const u of body.data) {
        expect(u).toHaveProperty('id');
        expect(u).toHaveProperty('usuario');
        expect(u).toHaveProperty('papel');
        expect(u).not.toHaveProperty('hashSenha');
      }
    });

    it('403: usuários sem papel de ADMINISTRADOR não podem listar usuários', async () => {
      const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
      const res = await chamar('GET', '/api/v1/usuarios', op);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('2. Organizações — Edição e Desativação Lógica', () => {
    it('PATCH /api/v1/organizacoes/:id: atualiza dados cadastrais mantendo CNPJ imutável', async () => {
      const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
      const org = await db.semear.organizacao({
        razaoSocial: 'Empresa Alpha',
        enderecoCompleto: 'Rua Um, 10',
        telefone: '11999990000',
        email: 'alpha@teste.com',
      });

      const res = await chamar('PATCH', `/api/v1/organizacoes/${org.id}`, op, {
        razaoSocial: 'Empresa Alpha Atualizada',
        enderecoCompleto: 'Av Nova, 500',
        telefone: '11988887777',
        email: 'novo-alpha@teste.com',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({
        id: org.id,
        razaoSocial: 'Empresa Alpha Atualizada',
        enderecoCompleto: 'Av Nova, 500',
        telefone: '11988887777',
        email: 'novo-alpha@teste.com',
        cnpj: org.cnpj, // CNPJ inalterado
      });
    });

    it('PATCH /api/v1/organizacoes/:id: 400 se nenhum campo for enviado', async () => {
      const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
      const org = await db.semear.organizacao();
      const res = await chamar('PATCH', `/api/v1/organizacoes/${org.id}`, op, {});
      expect(res.statusCode).toBe(400);
    });

    it('PATCH /api/v1/organizacoes/:id/desativar: desativa organização e bloqueia novas operações', async () => {
      const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
      const ga = await db.semear.usuario({ papel: 'GESTOR_ALMOXARIFADO' });
      const org = await db.semear.organizacao();

      // Desativa
      const resDesativar = await chamar('PATCH', `/api/v1/organizacoes/${org.id}/desativar`, op);
      expect(resDesativar.statusCode).toBe(200);
      expect(resDesativar.json().data.ativo).toBe(false);

      // Tentar desativar novamente retorna 400
      const resJaInativa = await chamar('PATCH', `/api/v1/organizacoes/${org.id}/desativar`, op);
      expect(resJaInativa.statusCode).toBe(400);
      expect(resJaInativa.json().message).toBe('A organização já se encontra inativa.');

      // Bloqueia novo lote para organização inativa
      const resNovoLote = await chamar('POST', '/api/v1/lotes', ga, {
        organizacaoId: org.id,
        notaFiscal: 'NF-INATIVA-1',
        transportadora: 'Transp',
      });
      expect(resNovoLote.statusCode).toBe(400);
      expect(resNovoLote.json().message).toBe('Organização inativa não pode receber novos lotes.');

      // Bloqueia novo contrato para organização inativa
      const resNovoContrato = await chamar('POST', `/api/v1/organizacoes/${org.id}/contrato`, op, {
        dataAssinatura: new Date().toISOString(),
        dataVencimento: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        clausulas: ['Cláusula teste'],
        valorMensal: 1000,
      });
      expect(resNovoContrato.statusCode).toBe(400);
      expect(resNovoContrato.json().message).toBe('Não é possível vincular contrato a uma organização inativa.');
    });
  });

  describe('3. Lotes — Edição e Exclusão', () => {
    it('PATCH /api/v1/lotes/:id: edita transportadora e observacoes enquanto não FINALIZADO', async () => {
      const ga = await db.semear.usuario({ papel: 'GESTOR_ALMOXARIFADO' });
      const org = await db.semear.organizacao();
      const lote = await db.semear.lote(org.id, { transportadora: 'Velha', observacoes: 'Obs antiga' });

      const res = await chamar('PATCH', `/api/v1/lotes/${lote.id}`, ga, {
        transportadora: 'Nova Transportadora Express',
        observacoes: 'Novas observações atualizadas',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({
        transportadora: 'Nova Transportadora Express',
        observacoes: 'Novas observações atualizadas',
      });
    });

    it('PATCH /api/v1/lotes/:id: 400 se o lote já estiver FINALIZADO', async () => {
      const ga = await db.semear.usuario({ papel: 'GESTOR_ALMOXARIFADO' });
      const org = await db.semear.organizacao();
      const lote = await db.semear.lote(org.id, { statusProcessamento: 'FINALIZADO' });

      const res = await chamar('PATCH', `/api/v1/lotes/${lote.id}`, ga, {
        transportadora: 'Tentativa',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toBe('Lotes finalizados não podem ser alterados.');
    });

    it('DELETE /api/v1/lotes/:id: 200 exclui com sucesso lote em RECEBIDO sem equipamentos', async () => {
      const ga = await db.semear.usuario({ papel: 'GESTOR_ALMOXARIFADO' });
      const org = await db.semear.organizacao();
      const lote = await db.semear.lote(org.id, { statusProcessamento: 'RECEBIDO' });

      const res = await chamar('DELETE', `/api/v1/lotes/${lote.id}`, ga);
      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe('Lote excluído com sucesso.');

      // Consulta posterior dá 404
      const resBusca = await chamar('GET', `/api/v1/lotes/${lote.id}`, ga);
      expect(resBusca.statusCode).toBe(404);
    });

    it('DELETE /api/v1/lotes/:id: 400 se lote tiver equipamentos vinculados ou status avançado', async () => {
      const ga = await db.semear.usuario({ papel: 'GESTOR_ALMOXARIFADO' });
      const org = await db.semear.organizacao();
      const loteComEquip = await db.semear.lote(org.id, { statusProcessamento: 'RECEBIDO' });
      await db.semear.equipamento(loteComEquip.id);

      // Com equipamentos -> 400
      const resComEquip = await chamar('DELETE', `/api/v1/lotes/${loteComEquip.id}`, ga);
      expect(resComEquip.statusCode).toBe(400);
      expect(resComEquip.json().message).toBe('Não é permitido excluir um lote que possui equipamentos vinculados.');

      // Status diferente de RECEBIDO sem equipamentos -> 400
      const loteTriagem = await db.semear.lote(org.id, { statusProcessamento: 'EM_TRIAGEM' });
      const resTriagem = await chamar('DELETE', `/api/v1/lotes/${loteTriagem.id}`, ga);
      expect(resTriagem.statusCode).toBe(400);
      expect(resTriagem.json().message).toContain("Apenas lotes 'RECEBIDO' podem ser excluídos.");
    });
  });

  describe('4. Equipamentos — Edição e Exclusão', () => {
    it('PATCH /api/v1/equipamentos/:id: atualiza metadados descritivos em lote aberto', async () => {
      const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
      const org = await db.semear.organizacao();
      const lote = await db.semear.lote(org.id);
      const equip = await db.semear.equipamento(lote.id, { marca: 'Dell', modelo: 'Inspiron', anoFabricacao: 2021, pesoQuilogramas: 2.1 });

      const res = await chamar('PATCH', `/api/v1/equipamentos/${equip.id}`, op, {
        marca: 'Dell Enterprise',
        modelo: 'Latitude 5420',
        anoFabricacao: 2022,
        pesoQuilogramas: 1.8,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({
        id: equip.id,
        marca: 'Dell Enterprise',
        modelo: 'Latitude 5420',
        anoFabricacao: 2022,
        pesoQuilogramas: 1.8,
      });
    });

    it('PATCH /api/v1/equipamentos/:id: 400 para ano de fabricação futuro ou lote fechado', async () => {
      const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
      const org = await db.semear.organizacao();
      const lote = await db.semear.lote(org.id);
      const equip = await db.semear.equipamento(lote.id);

      // Ano futuro -> 400
      const resAnoFuturo = await chamar('PATCH', `/api/v1/equipamentos/${equip.id}`, op, {
        anoFabricacao: 2099,
      });
      expect(resAnoFuturo.statusCode).toBe(400);

      // Lote fechado (ex: FINALIZADO) -> 400
      const loteFinalizado = await db.semear.lote(org.id, { statusProcessamento: 'FINALIZADO' });
      const equipLoteFechado = await db.semear.equipamento(loteFinalizado.id);

      const resLoteFechado = await chamar('PATCH', `/api/v1/equipamentos/${equipLoteFechado.id}`, op, {
        marca: 'Nova Marca',
      });
      expect(resLoteFechado.statusCode).toBe(400);
      expect(resLoteFechado.json().message).toContain('Não é permitido adicionar ou alterar equipamentos');
    });

    it('DELETE /api/v1/equipamentos/:id: 200 exclui equipamento em AGUARDANDO_TRIAGEM sem movimentações', async () => {
      const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
      const org = await db.semear.organizacao();
      const lote = await db.semear.lote(org.id, { statusProcessamento: 'EM_TRIAGEM' });
      const equip = await db.semear.equipamento(lote.id, { statusRastreamento: 'AGUARDANDO_TRIAGEM' });

      const res = await chamar('DELETE', `/api/v1/equipamentos/${equip.id}`, op);
      expect(res.statusCode).toBe(200);
      expect(res.json().message).toBe('Equipamento excluído com sucesso.');

      // Não consta mais
      const resRastreio = await chamar('GET', `/api/v1/equipamentos/rastrear/${equip.id}`, op);
      expect(resRastreio.statusCode).toBe(404);
    });

    it('DELETE /api/v1/equipamentos/:id: 400 se equipamento já foi movimentado ou está em status avançado', async () => {
      const op = await db.semear.usuario({ papel: 'OPERADOR_CADASTRO' });
      const org = await db.semear.organizacao();
      const lote = await db.semear.lote(org.id, { statusProcessamento: 'EM_TRIAGEM' });

      // Equipamento com status avançado (ex: EM_TRIAGEM) -> 400
      const equipEmTriagem = await db.semear.equipamento(lote.id, { statusRastreamento: 'EM_TRIAGEM' });
      const resEmTriagem = await chamar('DELETE', `/api/v1/equipamentos/${equipEmTriagem.id}`, op);
      expect(resEmTriagem.statusCode).toBe(400);
      expect(resEmTriagem.json().message).toContain("Apenas equipamentos 'AGUARDANDO_TRIAGEM' podem ser excluídos.");

      // Equipamento em AGUARDANDO_TRIAGEM mas com histórico de movimentação -> 400
      const equipComMov = await db.semear.equipamento(lote.id, { statusRastreamento: 'AGUARDANDO_TRIAGEM' });
      await db.equipamentoRepository.registrarMovimentacao({
        equipamentoId: equipComMov.id,
        origem: 'Recepcao',
        destino: 'Bancada',
        responsavel: 'Tecnico',
      });

      const resComMov = await chamar('DELETE', `/api/v1/equipamentos/${equipComMov.id}`, op);
      expect(resComMov.statusCode).toBe(400);
      expect(resComMov.json().message).toBe('Não é permitido excluir equipamento que já possui histórico de movimentações.');
    });
  });
});
