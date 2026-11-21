import { ReportFormat } from '../../domain/shared/enums.js';

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str: string;
  if (value instanceof Date) {
    str = value.toISOString();
  } else if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Serializador puro de relatórios (CSV com escape RFC 4180 e JSON formatado).
 */
export const ReportExporter = {
  toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) {
      return '';
    }

    const headers = Array.from(
      rows.reduce((acc, row) => {
        for (const key of Object.keys(row)) {
          acc.add(key);
        }
        return acc;
      }, new Set<string>()),
    );

    const headerLine = headers.map((h) => escapeCsvCell(h)).join(',');
    const dataLines = rows.map((row) =>
      headers.map((header) => escapeCsvCell(row[header])).join(','),
    );

    return [headerLine, ...dataLines].join('\n');
  },

  toJson(data: unknown): string {
    return JSON.stringify(data, null, 2);
  },

  serialize(data: Record<string, unknown>[] | Record<string, unknown>, format: ReportFormat): string {
    if (format === ReportFormat.JSON) {
      return this.toJson(data);
    }

    const rows = Array.isArray(data) ? data : [data];
    return this.toCsv(rows);
  },
};
