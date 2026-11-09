import dotenv from 'dotenv';
import path from 'path';
import { EnvValidationError, parseEnv, type Env } from './env.parser.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function loadEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (err) {
    if (err instanceof EnvValidationError) {
      // Falha rápida: o logger depende da configuração, então emitimos uma linha JSON
      // estruturada (mesmo formato do logger) e encerramos, sem stack trace.
      process.stderr.write(
        JSON.stringify({
          level: 'fatal',
          time: new Date().toISOString(),
          msg: 'Configuração de ambiente inválida. Consulte o arquivo .env.example.',
          problemas: err.issues,
        }) + '\n'
      );
      process.exit(1);
    }
    throw err;
  }
}

export const env: Readonly<Env> = Object.freeze(loadEnv());
