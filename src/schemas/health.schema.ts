import { z } from 'zod';
import { envelope } from './common.schema.js';

export const healthResponseSchema = envelope(
  z.object({
    status: z.literal('ok'),
    uptime: z.number(),
    timestamp: z.string(),
  })
);
