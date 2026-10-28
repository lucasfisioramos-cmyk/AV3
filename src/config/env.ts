import dotenv from 'dotenv';
import path from 'path';
import { EnvValidationError, parseEnv, type Env } from './env.parser.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function loadEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (err) {
    if (err instanceof EnvValidationError) {
      // Falha rápida e legível: sem stack trace, o problema é de configuração.
      console.error(`❌ ${err.message}\nConsulte o arquivo .env.example.`);
      process.exit(1);
    }
    throw err;
  }
}

export const env: Readonly<Env> = Object.freeze(loadEnv());
