export const NODE_ENVS = ['development', 'production', 'test'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export interface Env {
  NODE_ENV: NodeEnv;
  PORT: number;
  HOST: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  /** Validade do token (ex.: 15m, 8h, 1d). */
  JWT_EXPIRES_IN: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
}

export class EnvValidationError extends Error {
  public readonly issues: string[];

  constructor(issues: string[]) {
    super(`Variáveis de ambiente inválidas:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

const JWT_SECRET_MIN_LENGTH_PRODUCTION = 32;
const JWT_EXPIRES_IN_FORMATO = /^[1-9]\d*[smhd]$/;

function isBlank(value: string | undefined): value is undefined {
  return value === undefined || value.trim() === '';
}

/**
 * Valida e converte as variáveis de ambiente. Função pura (sem efeitos
 * colaterais) para poder ser testada com qualquer objeto de origem.
 * Reúne todos os problemas encontrados e lança um único EnvValidationError.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const issues: string[] = [];

  // NODE_ENV (obrigatória)
  const nodeEnvRaw = source.NODE_ENV?.trim();
  let nodeEnv: NodeEnv = 'development';
  if (isBlank(nodeEnvRaw)) {
    issues.push(`NODE_ENV é obrigatória (${NODE_ENVS.join(' | ')}).`);
  } else if (!(NODE_ENVS as readonly string[]).includes(nodeEnvRaw)) {
    issues.push(`NODE_ENV "${nodeEnvRaw}" é inválida. Use: ${NODE_ENVS.join(' | ')}.`);
  } else {
    nodeEnv = nodeEnvRaw as NodeEnv;
  }

  // DATABASE_URL (obrigatória, PostgreSQL)
  const databaseUrl = source.DATABASE_URL?.trim();
  if (isBlank(databaseUrl)) {
    issues.push('DATABASE_URL é obrigatória (ex.: postgresql://usuario:senha@localhost:5432/banco).');
  } else if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    issues.push('DATABASE_URL deve ser uma URL PostgreSQL (postgresql://...).');
  }

  // JWT_SECRET (obrigatória)
  const jwtSecret = source.JWT_SECRET;
  if (isBlank(jwtSecret)) {
    issues.push('JWT_SECRET é obrigatória.');
  } else if (nodeEnv === 'production' && jwtSecret.length < JWT_SECRET_MIN_LENGTH_PRODUCTION) {
    issues.push(`JWT_SECRET deve ter no mínimo ${JWT_SECRET_MIN_LENGTH_PRODUCTION} caracteres em produção.`);
  }

  // JWT_EXPIRES_IN / JWT_ISSUER / JWT_AUDIENCE (opcionais, com padrões seguros)
  const jwtExpiresIn = isBlank(source.JWT_EXPIRES_IN) ? '8h' : source.JWT_EXPIRES_IN!.trim();
  if (!JWT_EXPIRES_IN_FORMATO.test(jwtExpiresIn)) {
    issues.push(`JWT_EXPIRES_IN "${jwtExpiresIn}" é inválida. Use número + unidade (s, m, h, d), ex.: 15m, 8h, 1d.`);
  }
  const jwtIssuer = isBlank(source.JWT_ISSUER) ? 'greencode-api' : source.JWT_ISSUER!.trim();
  const jwtAudience = isBlank(source.JWT_AUDIENCE) ? 'greencode-clients' : source.JWT_AUDIENCE!.trim();

  // PORT (opcional, padrão 3000)
  let port = 3000;
  const portRaw = source.PORT?.trim();
  if (!isBlank(portRaw)) {
    const parsed = Number(portRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      issues.push(`PORT "${portRaw}" é inválida. Informe um inteiro entre 1 e 65535.`);
    } else {
      port = parsed;
    }
  }

  // HOST (opcional, padrão 0.0.0.0)
  const host = isBlank(source.HOST) ? '0.0.0.0' : source.HOST!.trim();

  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    HOST: host,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: jwtSecret!,
    JWT_EXPIRES_IN: jwtExpiresIn,
    JWT_ISSUER: jwtIssuer,
    JWT_AUDIENCE: jwtAudience,
  };
}
