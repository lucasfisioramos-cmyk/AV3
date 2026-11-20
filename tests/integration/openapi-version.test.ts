import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { fecharApp, obterApp } from '../helpers/app.js';

afterAll(fecharApp);

const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')
) as { version: string };

describe('Sincronização de Versão OpenAPI com package.json (TASK-14 / Q6)', () => {
  it('OpenAPI spec (/docs/json) reflete exatamente a versão definida em package.json', async () => {
    const app = await obterApp();
    const res = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec).toHaveProperty('openapi');
    expect(spec).toHaveProperty('info');
    expect(spec.info.title).toBe('Greencode API');
    expect(spec.info.version).toBe(packageJson.version);
    expect(spec.info.version).toBe('2.1.0');
  });
});
