import { invalido, valido, type ResultadoValidacao } from './resultado.js';

/**
 * Política de senha (aplicada ao CRIAR ou ALTERAR senhas; nunca no login,
 * para não bloquear quem já tem uma senha antiga).
 */
export const POLITICA_SENHA = {
  minimoCaracteres: 8,
  /** O bcrypt só considera os 72 primeiros BYTES. */
  maximoBytes: 72,
} as const;

// Senhas comuns que atendem à regra de caracteres mas são triviais de adivinhar.
const SENHAS_COMUNS = new Set([
  'senha123!', 'senha@123', 'senha#123', 'senha123@', 'password1!', 'password123!', 'passw0rd!',
  'p@ssw0rd', 'p@ssword1', 'qwerty123!', 'qwerty@123', 'abc12345!', 'abcd1234!', 'admin123!',
  'admin@123', 'admin#123', 'welcome1!', 'welcome@123', 'mudar123!', 'mudar@123', 'brasil123!',
  'brasil@123', 'letmein123!', 'changeme1!', 'trocar123!',
]);

export interface ContextoSenha {
  /** Nome de usuário: a senha não pode contê-lo. */
  usuario?: string;
}

export function validarSenha(senha: string, contexto: ContextoSenha = {}): ResultadoValidacao {
  const falhas: string[] = [];

  if (senha.length < POLITICA_SENHA.minimoCaracteres) {
    falhas.push(`no mínimo ${POLITICA_SENHA.minimoCaracteres} caracteres`);
  }
  if (!/\p{Lu}/u.test(senha)) falhas.push('uma letra maiúscula');
  if (!/\p{Ll}/u.test(senha)) falhas.push('uma letra minúscula');
  if (!/\p{Nd}/u.test(senha)) falhas.push('um número');
  if (!/[^\p{L}\p{N}\s]/u.test(senha)) falhas.push('um símbolo (ex.: ! @ # $ %)');

  if (falhas.length > 0) {
    return invalido(`A senha deve conter ${falhas.join(', ')}.`);
  }

  if (Buffer.byteLength(senha, 'utf8') > POLITICA_SENHA.maximoBytes) {
    return invalido(`A senha deve ter no máximo ${POLITICA_SENHA.maximoBytes} bytes.`);
  }

  const usuario = contexto.usuario?.trim().toLowerCase();
  if (usuario && usuario.length >= 3 && senha.toLowerCase().includes(usuario)) {
    return invalido('A senha não pode conter o nome de usuário.');
  }

  if (SENHAS_COMUNS.has(senha.toLowerCase())) {
    return invalido('Essa senha é muito comum. Escolha outra.');
  }

  return valido();
}
