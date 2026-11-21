/**
 * ÚNICO ponto em que o domínio, os schemas HTTP e a segurança tocam os enums do Prisma.
 * Se um dia os enums deixarem de vir do Prisma, só este arquivo muda.
 * (Valor e tipo são exportados juntos: `PapelUsuario.ADMINISTRADOR` e `: PapelUsuario`.)
 */
export {
  EstadoFisico,
  MetricType,
  PapelUsuario,
  ReportFormat,
  ReportJobStatus,
  StatusLote,
  StatusRastreamento,
  TipoEquipamento,
} from '@prisma/client';
