import { describe, expect, it } from 'vitest';
import { gerarCodigoBarrasInterno } from '../../../src/domain/equipamento/equipamento.codigo.js';
import { EquipamentoRules } from '../../../src/domain/equipamento/equipamento.rules.js';
import { EquipamentoService } from '../../../src/domain/equipamento/equipamento.service.js';
import { ConflictError, NotFoundError, RegraDeNegocioError } from '../../../src/errors/app-error.js';
import { db } from '../../helpers/fakes.js';

describe('EquipamentoRules', () => {
  it('ano de fabricação: entre 1900 e o ano atual', () => {
    expect(() => EquipamentoRules.exigirAnoFabricacaoValido(1900, 2026)).not.toThrow();
    expect(() => EquipamentoRules.exigirAnoFabricacaoValido(2026, 2026)).not.toThrow();
    expect(() => EquipamentoRules.exigirAnoFabricacaoValido(1899, 2026)).toThrow(RegraDeNegocioError);
    expect(() => EquipamentoRules.exigirAnoFabricacaoValido(2027, 2026)).toThrow(RegraDeNegocioError);
    expect(() => EquipamentoRules.exigirAnoFabricacaoValido(new Date().getFullYear() + 1)).toThrow(RegraDeNegocioError);
  });

  it('peso deve ser positivo', () => {
    expect(() => EquipamentoRules.exigirPesoPositivo(0.1)).not.toThrow();
    expect(() => EquipamentoRules.exigirPesoPositivo(0)).toThrow(RegraDeNegocioError);
    expect(() => EquipamentoRules.exigirPesoPositivo(-1)).toThrow(RegraDeNegocioError);
  });

  describe('trava de desmonte', () => {
    it.each(['EM_DESMONTE', 'AGUARDANDO_DESMONTE'] as const)('%s só é permitido a partir de EM_TRIAGEM', (destino) => {
      expect(() => EquipamentoRules.exigirTriagemAntesDoDesmonte('EM_TRIAGEM', destino)).not.toThrow();
      for (const origem of ['AGUARDANDO_TRIAGEM', 'EM_DESMONTE', 'AGUARDANDO_DESMONTE'] as const) {
        expect(() => EquipamentoRules.exigirTriagemAntesDoDesmonte(origem, destino)).toThrow(/triagem completa/);
      }
    });

    it('outros destinos não são afetados pela trava', () => {
      expect(() => EquipamentoRules.exigirTriagemAntesDoDesmonte('AGUARDANDO_TRIAGEM', 'EM_TRIAGEM')).not.toThrow();
    });
  });

  describe('rebaixamento do estado físico', () => {
    it('rebaixar 2+ categorias exige justificativa', () => {
      expect(() => EquipamentoRules.exigirJustificativaParaRebaixamento('NOVO', 'USADO_LEVE')).toThrow(/justificativa/);
      expect(() => EquipamentoRules.exigirJustificativaParaRebaixamento('BOM_ESTADO', 'INSERVIVEL', '   ')).toThrow(/justificativa/);
      expect(() => EquipamentoRules.exigirJustificativaParaRebaixamento('NOVO', 'USADO_LEVE', 'Caiu no transporte')).not.toThrow();
    });

    it('rebaixar 1 categoria, manter ou melhorar não exige', () => {
      expect(() => EquipamentoRules.exigirJustificativaParaRebaixamento('NOVO', 'BOM_ESTADO')).not.toThrow();
      expect(() => EquipamentoRules.exigirJustificativaParaRebaixamento('BOM_ESTADO', 'BOM_ESTADO')).not.toThrow();
      expect(() => EquipamentoRules.exigirJustificativaParaRebaixamento('INSERVIVEL', 'NOVO')).not.toThrow();
    });
  });

  it('versão: divergente -> ConflictError', () => {
    expect(() => EquipamentoRules.exigirVersaoAtual(1, 1, 'x')).not.toThrow();
    expect(() => EquipamentoRules.exigirVersaoAtual(2, 1, 'x')).toThrow(ConflictError);
  });

  it('identificador é obrigatório', () => {
    expect(() => EquipamentoRules.exigirIdentificador('')).toThrow(RegraDeNegocioError);
    expect(() => EquipamentoRules.exigirIdentificador('abc')).not.toThrow();
  });
});

describe('gerarCodigoBarrasInterno', () => {
  it('GC-<4 do lote>-<3 do tipo>-<posição com 3 dígitos>', () => {
    expect(gerarCodigoBarrasInterno('abcd1234-0000', 'NOTEBOOK', 7)).toBe('GC-abcd-NOT-007');
    expect(gerarCodigoBarrasInterno('abcd1234', 'SERVIDOR', 123)).toBe('GC-abcd-SER-123');
  });
});

describe('EquipamentoService', () => {
  const novo = (loteId: string, extra = {}) => ({
    loteId, tipo: 'NOTEBOOK' as const, marca: 'Dell', modelo: 'X', anoFabricacao: 2020, estadoFisico: 'BOM_ESTADO' as const, pesoQuilogramas: 2, ...extra,
  });

  it('cadastro: posição/código sequenciais e o 1º item move o lote para EM_TRIAGEM (transação serializável)', async () => {
    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id);
    const a = await EquipamentoService.criarEquipamento(novo(lote.id));
    const b = await EquipamentoService.criarEquipamento(novo(lote.id));
    expect([a.posicaoNoLote, b.posicaoNoLote]).toEqual([1, 2]);
    expect(a.codigoBarrasInterno).toBe(`GC-${lote.id.slice(0, 4)}-NOT-001`);
    expect(a.statusRastreamento).toBe('AGUARDANDO_TRIAGEM');
    expect(db.lotes.get(lote.id)?.statusProcessamento).toBe('EM_TRIAGEM');
    expect(db.transacoes.every((t) => t.isolamento === 'serializavel')).toBe(true);
  });

  it('lote inexistente -> 404 e nada é gravado; ano/peso inválidos não abrem transação', async () => {
    await expect(EquipamentoService.criarEquipamento(novo('x'))).rejects.toBeInstanceOf(NotFoundError);
    await expect(EquipamentoService.criarEquipamento(novo('x', { anoFabricacao: 1800 }))).rejects.toBeInstanceOf(RegraDeNegocioError);
    await expect(EquipamentoService.criarEquipamento(novo('x', { pesoQuilogramas: 0 }))).rejects.toBeInstanceOf(RegraDeNegocioError);
    expect(db.equipamentos.size).toBe(0);
    expect(db.transacoes).toHaveLength(1);
  });

  it('movimentação: trava de desmonte, versão desatualizada (409) e sucesso registrando histórico', async () => {
    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id);
    const eq = await db.semear.equipamento(lote.id);
    const mov = { id: eq.id, origem: 'A', destino: 'B', responsavel: 'Zé', version: eq.version };

    await expect(EquipamentoService.movimentarEquipamento({ ...mov, novoStatus: 'EM_DESMONTE' })).rejects.toThrow(/triagem completa/);
    await expect(EquipamentoService.movimentarEquipamento({ ...mov, novoStatus: 'EM_TRIAGEM', version: eq.version + 5 })).rejects.toBeInstanceOf(ConflictError);

    const r = await EquipamentoService.movimentarEquipamento({ ...mov, novoStatus: 'EM_TRIAGEM' });
    expect(r.equipamentoAtualizado.statusRastreamento).toBe('EM_TRIAGEM');
    expect(r.equipamentoAtualizado.version).toBe(eq.version + 1);
    expect(db.movimentacoes.size).toBe(1);

    // reutilizar a versão antiga agora conflita
    await expect(EquipamentoService.movimentarEquipamento({ ...mov, novoStatus: 'EM_DESMONTE' })).rejects.toBeInstanceOf(ConflictError);
    // com a versão nova e o status EM_TRIAGEM, o desmonte é liberado
    await expect(EquipamentoService.movimentarEquipamento({ ...mov, novoStatus: 'EM_DESMONTE', version: eq.version + 1 })).resolves.toBeDefined();
    await expect(EquipamentoService.movimentarEquipamento({ ...mov, id: 'nao-existe', novoStatus: 'EM_TRIAGEM' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('movimentação: falha de concorrência na escrita desfaz tudo (rollback)', async () => {
    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id);
    const eq = await db.semear.equipamento(lote.id);
    const original = db.equipamentoRepository.atualizarComVersao;
    db.equipamentoRepository.atualizarComVersao = async () => null;
    try {
      await expect(
        EquipamentoService.movimentarEquipamento({ id: eq.id, novoStatus: 'EM_TRIAGEM', origem: 'A', destino: 'B', responsavel: 'Z', version: eq.version })
      ).rejects.toBeInstanceOf(ConflictError);
    } finally {
      db.equipamentoRepository.atualizarComVersao = original;
    }
    expect(db.movimentacoes.size).toBe(0);
  });

  it('estado físico: justificativa, versão e atualização', async () => {
    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id);
    const eq = await db.semear.equipamento(lote.id, { estadoFisico: 'NOVO' });
    await expect(EquipamentoService.alterarEstadoFisico({ id: eq.id, novoEstado: 'USADO_MODERADO', version: eq.version })).rejects.toThrow(/justificativa/);
    await expect(EquipamentoService.alterarEstadoFisico({ id: eq.id, novoEstado: 'BOM_ESTADO', version: 99 })).rejects.toBeInstanceOf(ConflictError);
    const ok = await EquipamentoService.alterarEstadoFisico({ id: eq.id, novoEstado: 'USADO_MODERADO', justificativa: 'Tela trincada', version: eq.version });
    expect(ok.estadoFisico).toBe('USADO_MODERADO');
    await expect(EquipamentoService.alterarEstadoFisico({ id: 'x', novoEstado: 'NOVO', version: 0 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rastrear: por id ou por código de barras; inexistente -> 404; vazio -> regra', async () => {
    const org = await db.semear.organizacao();
    const lote = await db.semear.lote(org.id);
    const eq = await db.semear.equipamento(lote.id);
    expect((await EquipamentoService.rastrear(eq.id)).id).toBe(eq.id);
    expect((await EquipamentoService.rastrear(eq.codigoBarrasInterno)).id).toBe(eq.id);
    await expect(EquipamentoService.rastrear('nada')).rejects.toBeInstanceOf(NotFoundError);
    await expect(EquipamentoService.rastrear('')).rejects.toBeInstanceOf(RegraDeNegocioError);
  });
});
