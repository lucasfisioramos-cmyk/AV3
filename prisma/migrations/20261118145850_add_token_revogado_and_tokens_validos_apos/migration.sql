-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "tokensValidosApos" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tokens_revogados" (
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_revogados_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "tokens_revogados_expiresAt_idx" ON "tokens_revogados"("expiresAt");
