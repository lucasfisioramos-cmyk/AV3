-- O bcrypt embute o salt no próprio hash; a coluna separada era redundante.
-- AlterTable
ALTER TABLE "usuarios" DROP COLUMN "salt";
