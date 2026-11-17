import 'dotenv/config';
import { PapelUsuario } from '@prisma/client';
import { createPrismaClient } from '../src/persistence/client.js';
import { PasswordHasher } from '../src/security/hasher.js';
import { validarSenha } from '../src/domain/validators/senha.js';

const prisma = createPrismaClient();

const SENHA_PADRAO_DESENVOLVIMENTO = 'Greencode#Dev2026';

function obterSenhaDoAdmin(): string {
  const informada = process.env.SEED_ADMIN_PASSWORD;
  if (informada) return informada;

  // A senha padrão é pública (está no código): só é aceita fora de produção.
  if (['development', 'test'].includes(process.env.NODE_ENV ?? '')) return SENHA_PADRAO_DESENVOLVIMENTO;

  throw new Error(
    'Defina SEED_ADMIN_PASSWORD para executar o seed (a senha padrão só é usada com NODE_ENV=development ou test).'
  );
}

async function main() {
  const usuarioAdmin = 'admin';
  const senhaPlana = obterSenhaDoAdmin();

  const validacao = validarSenha(senhaPlana, { usuario: usuarioAdmin });
  if (!validacao.valido) throw new Error(`SEED_ADMIN_PASSWORD inválida: ${validacao.mensagem}`);

  const hashSenha = await PasswordHasher.hashPassword(senhaPlana);

  await prisma.usuario.upsert({
    where: { usuario: usuarioAdmin },
    update: {},
    create: {
      usuario: usuarioAdmin,
      hashSenha,
      papel: PapelUsuario.ADMINISTRADOR,
    },
  });

  console.log('✅ Usuário Admin sincronizado com sucesso no banco!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erro no seed:', e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
