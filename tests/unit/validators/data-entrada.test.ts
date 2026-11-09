import { describe, expect, it } from 'vitest';
import { JANELA_ENTRADA_LOTE_DIAS, validarDataEntrada } from '../../../src/domain/validators/data-entrada.js';

const agora = new Date('2026-10-28T12:00:00Z');
const diasAtras = (dias: number, extraMs = 0) => new Date(agora.getTime() - dias * 86_400_000 - extraMs);

describe('validarDataEntrada (regra legada da AV1: nem futura, nem anterior a 90 dias)', () => {
  it('aceita agora e datas recentes', () => {
    expect(validarDataEntrada(agora, agora).valido).toBe(true);
    expect(validarDataEntrada(diasAtras(1), agora).valido).toBe(true);
    expect(validarDataEntrada(diasAtras(89), agora).valido).toBe(true);
  });

  it('rejeita data futura', () => {
    const r = validarDataEntrada(new Date(agora.getTime() + 1000), agora);
    expect(r).toEqual({ valido: false, mensagem: 'A data de entrada do lote não pode ser uma data futura.' });
  });

  it('rejeita data anterior à janela de 90 dias', () => {
    const r = validarDataEntrada(diasAtras(91), agora);
    expect(r).toEqual({ valido: false, mensagem: 'A data de entrada do lote não pode ser anterior a 90 dias.' });
    expect(JANELA_ENTRADA_LOTE_DIAS).toBe(90);
  });

  it('o limite de 90 dias é inclusivo', () => {
    const limite = new Date(agora);
    limite.setDate(limite.getDate() - 90);
    expect(validarDataEntrada(limite, agora).valido).toBe(true);
    expect(validarDataEntrada(new Date(limite.getTime() - 1), agora).valido).toBe(false);
  });

  it('rejeita datas inválidas (antes passavam silenciosamente)', () => {
    expect(validarDataEntrada(new Date('data-invalida'), agora)).toEqual({
      valido: false,
      mensagem: 'A data de entrada do lote é inválida.',
    });
  });

  it('usa o relógio atual quando "agora" não é informado', () => {
    expect(validarDataEntrada(new Date()).valido).toBe(true);
  });
});
