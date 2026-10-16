import { z } from 'zod';

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  actorId: z.string().uuid().optional(),
  action: z.string().trim().min(1).max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict().refine((query) => !query.from || !query.to || query.from <= query.to, {
  message: 'from must be before or equal to to',
  path: ['from'],
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;
