import type { Prisma } from '@prisma/client';
import type { ReportFormat, ReportJobStatus } from '../domain/shared/enums.js';
import { prisma } from './prisma.js';
import type { Transacao } from './transaction.js';

export interface ReportJobRecord {
  id: string;
  bullJobId: string | null;
  apiKeyId: string;
  reportType: string;
  format: ReportFormat;
  status: ReportJobStatus;
  filePath: string | null;
  errorReason: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateReportJobData {
  apiKeyId: string;
  reportType: string;
  format: ReportFormat;
  bullJobId?: string | null;
}

export interface UpdateReportJobStatusExtra {
  filePath?: string | null;
  errorReason?: string | null;
  completedAt?: Date | null;
}

export interface ReportJobRepository {
  create(data: CreateReportJobData, tx?: Transacao): Promise<ReportJobRecord>;
  findById(id: string, tx?: Transacao): Promise<ReportJobRecord | null>;
  attachBullJobId(id: string, bullJobId: string, tx?: Transacao): Promise<ReportJobRecord>;
  updateStatus(
    id: string,
    status: ReportJobStatus,
    extra?: UpdateReportJobStatusExtra,
    tx?: Transacao,
  ): Promise<ReportJobRecord>;
}

const SELECT_REPORT_JOB = {
  id: true,
  bullJobId: true,
  apiKeyId: true,
  reportType: true,
  format: true,
  status: true,
  filePath: true,
  errorReason: true,
  createdAt: true,
  completedAt: true,
} as const satisfies Prisma.ReportJobSelect;

class PrismaReportJobRepository implements ReportJobRepository {
  create(data: CreateReportJobData, tx?: Transacao): Promise<ReportJobRecord> {
    return (tx ?? prisma).reportJob.create({
      data,
      select: SELECT_REPORT_JOB,
    });
  }

  findById(id: string, tx?: Transacao): Promise<ReportJobRecord | null> {
    return (tx ?? prisma).reportJob.findUnique({
      where: { id },
      select: SELECT_REPORT_JOB,
    });
  }

  attachBullJobId(id: string, bullJobId: string, tx?: Transacao): Promise<ReportJobRecord> {
    return (tx ?? prisma).reportJob.update({
      where: { id },
      data: { bullJobId },
      select: SELECT_REPORT_JOB,
    });
  }

  updateStatus(
    id: string,
    status: ReportJobStatus,
    extra: UpdateReportJobStatusExtra = {},
    tx?: Transacao,
  ): Promise<ReportJobRecord> {
    return (tx ?? prisma).reportJob.update({
      where: { id },
      data: {
        status,
        filePath: extra.filePath,
        errorReason: extra.errorReason,
        completedAt: extra.completedAt,
      },
      select: SELECT_REPORT_JOB,
    });
  }
}

export const ReportJobRepository: ReportJobRepository = new PrismaReportJobRepository();
