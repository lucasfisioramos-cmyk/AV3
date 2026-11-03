import type { TipoEquipamento } from '../shared/enums.js';

/** Código de barras interno: GC-<4 primeiros chars do lote>-<3 letras do tipo>-<posição com 3 dígitos>. */
export function gerarCodigoBarrasInterno(loteId: string, tipo: TipoEquipamento, posicaoNoLote: number): string {
  const prefixoTipo = tipo.substring(0, 3).toUpperCase();
  return `GC-${loteId.slice(0, 4)}-${prefixoTipo}-${posicaoNoLote.toString().padStart(3, '0')}`;
}
