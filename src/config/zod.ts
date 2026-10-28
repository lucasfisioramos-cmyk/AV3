import { z } from 'zod';

// Mensagens de validação em português para todos os schemas da aplicação.
z.config({
  ...z.locales.pt(),
  customError: (issue) =>
    issue.code === 'invalid_type' && issue.input === undefined ? 'Campo obrigatório.' : undefined,
});
