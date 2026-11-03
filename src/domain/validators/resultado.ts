/**
 * Convenção dos validadores (src/domain/validators):
 *  - funções PURAS: sem I/O, sem relógio global (data "atual" é parâmetro) e sem lançar erros;
 *  - retornam sempre um ResultadoValidacao;
 *  - quem decide o que fazer com a falha (e qual erro lançar) são as regras
 *    de cada módulo (`*.rules.ts`), usando `exigirValido`.
 */
export type ResultadoValidacao = { valido: true } | { valido: false; mensagem: string };

export const valido = (): ResultadoValidacao => ({ valido: true });
export const invalido = (mensagem: string): ResultadoValidacao => ({ valido: false, mensagem });
