-- DropIndex
DROP INDEX "contratos_organizacaoId_key";

-- AlterTable
ALTER TABLE "contratos" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "contratos_organizacaoId_ativo_idx" ON "contratos"("organizacaoId", "ativo");

-- CreatePartialUniqueIndex (apenas 1 contrato ativo por organização)
CREATE UNIQUE INDEX "contratos_organizacaoId_ativo_unique" ON "contratos"("organizacaoId") WHERE "ativo" = true;
