/*
  Warnings:

  - A unique constraint covering the columns `[organizacaoId,notaFiscal]` on the table `lotes` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "lotes_organizacao_id_nota_fiscal_key" ON "lotes"("organizacaoId", "notaFiscal");
