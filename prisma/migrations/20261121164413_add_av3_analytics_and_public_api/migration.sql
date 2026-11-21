-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('OPERATIONAL_EFFICIENCY', 'PROFITABILITY');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "ReportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_history" (
    "id" TEXT NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "dimension" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_rul_predictions" (
    "id" TEXT NOT NULL,
    "tipoEquipamento" "TipoEquipamento" NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "slope" DOUBLE PRECISION NOT NULL,
    "intercept" DOUBLE PRECISION NOT NULL,
    "estimatedDaysLeft" INTEGER NOT NULL,
    "predictedEndDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_rul_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_jobs" (
    "id" TEXT NOT NULL,
    "bullJobId" TEXT,
    "apiKeyId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "status" "ReportJobStatus" NOT NULL DEFAULT 'PENDING',
    "filePath" TEXT,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "report_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "analytics_history_metricType_calculatedAt_idx" ON "analytics_history"("metricType", "calculatedAt");

-- CreateIndex
CREATE INDEX "equipment_rul_predictions_marca_modelo_createdAt_idx" ON "equipment_rul_predictions"("marca", "modelo", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "report_jobs_bullJobId_key" ON "report_jobs"("bullJobId");

-- CreateIndex
CREATE INDEX "report_jobs_apiKeyId_createdAt_idx" ON "report_jobs"("apiKeyId", "createdAt");

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
