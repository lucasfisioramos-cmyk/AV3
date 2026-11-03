#!/usr/bin/env node
/**
 * Verificação de fronteira da camada de persistência.
 *  1. '@prisma/client' só pode ser importado em: src/persistence, src/repositories,
 *     src/domain/shared/enums.ts (enums) e src/errors/error-mapper.ts (classes de erro).
 *  2. A instância 'persistence/prisma' só pode ser importada por src/repositories,
 *     src/persistence e src/app.ts (desconexão no encerramento).
 * Uso: npm run check:arquitetura
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RAIZ = join(process.cwd(), 'src');
const norm = (p) => relative(process.cwd(), p).split(sep).join('/');

const PERMITE_PRISMA_CLIENT = [/^src\/persistence\//, /^src\/repositories\//, /^src\/domain\/shared\/enums\.ts$/, /^src\/errors\/error-mapper\.ts$/];
const PERMITE_INSTANCIA = [/^src\/persistence\//, /^src\/repositories\//, /^src\/app\.ts$/];

function listar(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? listar(caminho) : caminho.endsWith('.ts') ? [caminho] : [];
  });
}

const violacoes = [];
for (const arquivo of listar(RAIZ)) {
  const rel = norm(arquivo);
  const linhas = readFileSync(arquivo, 'utf8').split('\n');
  linhas.forEach((linha, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return; // ignora comentários
    if (/from\s+['"]@prisma\/client/.test(linha) && !PERMITE_PRISMA_CLIENT.some((r) => r.test(rel))) {
      violacoes.push(`${rel}:${i + 1} importa '@prisma/client' fora da camada de persistência`);
    }
    if (/from\s+['"][^'"]*persistence\/prisma(\.js)?['"]/.test(linha) && !PERMITE_INSTANCIA.some((r) => r.test(rel))) {
      violacoes.push(`${rel}:${i + 1} acessa a instância do Prisma diretamente`);
    }
  });
}

if (violacoes.length > 0) {
  console.error('❌ Violações da fronteira de persistência:\n' + violacoes.map((v) => `  - ${v}`).join('\n'));
  process.exit(1);
}
console.log('✅ Fronteira de persistência respeitada.');
