import { describe, expect, it } from 'vitest';
import { ReportFormat } from '../../../src/domain/shared/enums.js';
import { ReportExporter } from '../../../src/infrastructure/queue/report-exporter.js';

describe('ReportExporter', () => {
  it('toCsv: retorna string vazia quando a lista de registros está vazia', () => {
    expect(ReportExporter.toCsv([])).toBe('');
  });

  it('toCsv: gera cabeçalho e escapa vírgulas, aspas duplas e quebras de linha (RFC 4180)', () => {
    const data = new Date('2026-11-21T15:00:00.000Z');
    const csv = ReportExporter.toCsv([
      {
        codigo: 'GC-001',
        descricao: 'Notebook Dell, "Latitude" 5420',
        observacao: 'Linha 1\nLinha 2',
        criadoEm: data,
        nulo: null,
      },
    ]);

    const linhas = csv.split('\n');
    expect(linhas[0]).toBe('codigo,descricao,observacao,criadoEm,nulo');
    expect(csv).toContain('GC-001,"Notebook Dell, ""Latitude"" 5420","Linha 1\nLinha 2",2026-11-21T15:00:00.000Z,');
  });

  it('serialize: formata em JSON indentado ou CSV conforme o ReportFormat', () => {
    const payload = [{ metrica: 'EFICIENCIA', valor: 4.5 }];

    const json = ReportExporter.serialize(payload, ReportFormat.JSON);
    expect(JSON.parse(json)).toEqual(payload);

    const csv = ReportExporter.serialize(payload, ReportFormat.CSV);
    expect(csv).toBe('metrica,valor\nEFICIENCIA,4.5');
  });
});
