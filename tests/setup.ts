import { beforeEach, vi } from 'vitest';

// A camada de persistência é substituída por um banco em memória (tests/helpers/fakes.ts).
// Assim nenhum teste precisa de Postgres nem do motor de consultas do Prisma.
vi.mock('../src/repositories/usuario.repository.js', async () => ({
  UsuarioRepository: (await import('./helpers/fakes.js')).db.usuarioRepository,
}));
vi.mock('../src/repositories/token-revogado.repository.js', async () => ({
  TokenRevogadoRepository: (await import('./helpers/fakes.js')).db.tokenRevogadoRepository,
}));
vi.mock('../src/repositories/organizacao.repository.js', async () => ({
  OrganizacaoRepository: (await import('./helpers/fakes.js')).db.organizacaoRepository,
}));
vi.mock('../src/repositories/contrato.repository.js', async () => ({
  ContratoRepository: (await import('./helpers/fakes.js')).db.contratoRepository,
}));
vi.mock('../src/repositories/lote.repository.js', async () => ({
  LoteRepository: (await import('./helpers/fakes.js')).db.loteRepository,
}));
vi.mock('../src/repositories/equipamento.repository.js', async () => ({
  EquipamentoRepository: (await import('./helpers/fakes.js')).db.equipamentoRepository,
}));
vi.mock('../src/repositories/relatorio.repository.js', async () => ({
  RelatorioRepository: (await import('./helpers/fakes.js')).db.relatorioRepository,
}));
vi.mock('../src/persistence/transaction.js', async () => ({
  executarEmTransacao: async <T>(operacao: (tx: object) => Promise<T>, opcoes?: { isolamento?: string }) =>
    (await import('./helpers/fakes.js')).db.transacao(operacao, opcoes),
}));
vi.mock('../src/persistence/prisma.js', () => ({
  prisma: {},
  desconectarBanco: async () => {},
}));

beforeEach(async () => {
  (await import('./helpers/fakes.js')).db.reset();
});
