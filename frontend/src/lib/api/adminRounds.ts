import { apiRequest } from './client';
import { adminRoundListSchema, adminRoundSchema, createAdminRoundSchema, updateAdminRoundSchema } from '../../types/adminRound';
import type { CreateAdminRound, UpdateAdminRound } from '../../types/adminRound';

export async function listAdminRounds({ eventId, page = 1, limit = 20, signal }: { eventId: string; page?: number; limit?: number; signal?: AbortSignal }) {
  const query = new URLSearchParams({ eventId, page: String(page), limit: String(limit) });
  return adminRoundListSchema.parse(await apiRequest(`/admin/rounds?${query}`, { signal }));
}

export async function getAdminRound(id: string, signal?: AbortSignal) {
  const response = await apiRequest<{ round: unknown }>(`/admin/rounds/${encodeURIComponent(id)}`, { signal });
  return adminRoundSchema.parse(response?.round);
}

export async function createAdminRound(input: CreateAdminRound, signal?: AbortSignal) {
  const body = createAdminRoundSchema.parse(input);
  const response = await apiRequest<{ round: unknown }>('/admin/rounds', { method: 'POST', body: JSON.stringify(body), signal });
  return adminRoundSchema.parse(response?.round);
}

export async function updateAdminRound(id: string, input: UpdateAdminRound, signal?: AbortSignal) {
  const body = updateAdminRoundSchema.parse(input);
  const response = await apiRequest<{ round: unknown }>(`/admin/rounds/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body), signal });
  return adminRoundSchema.parse(response?.round);
}
