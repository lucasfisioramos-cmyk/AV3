-- A autenticação é JWT stateless; a tabela de sessões nunca foi usada pela aplicação.
-- DropForeignKey
ALTER TABLE "sessoes" DROP CONSTRAINT "sessoes_usuarioId_fkey";

-- DropTable
DROP TABLE "sessoes";
