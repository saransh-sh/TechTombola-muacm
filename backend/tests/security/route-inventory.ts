export type SecurityRole = 'PUBLIC' | 'AUTHENTICATED' | 'PARTICIPANT' | 'ADMIN' | 'SUPER_ADMIN';
export type ScopeBoundary = 'PUBLIC' | 'IDENTITY' | 'PARTICIPANT_EVENT' | 'GLOBAL';

export interface RouteInventoryEntry {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  role: SecurityRole;
  scope: ScopeBoundary;
  scopeReason?: string;
}

const global = (reason: string): Pick<RouteInventoryEntry, 'scope' | 'scopeReason'> => ({
  scope: 'GLOBAL',
  scopeReason: reason,
});

const publicRoute = (method: RouteInventoryEntry['method'], path: string): RouteInventoryEntry => ({
  method, path, role: 'PUBLIC', scope: 'PUBLIC',
});

const authenticatedRoute = (method: RouteInventoryEntry['method'], path: string): RouteInventoryEntry => ({
  method,
  path,
  role: 'AUTHENTICATED',
  scope: 'IDENTITY',
  scopeReason: 'The operation is bound to the authenticated identity; it has no separate Event or resource-owner selector.',
});

const participantRoute = (method: RouteInventoryEntry['method'], path: string): RouteInventoryEntry => ({
  method,
  path,
  role: 'PARTICIPANT',
  scope: 'PARTICIPANT_EVENT',
  scopeReason: 'The Participant profile fixes the Event boundary; per-route foreign Participant and Event request probes are required evidence.',
});

const adminRoute = (method: RouteInventoryEntry['method'], path: string, reason: string): RouteInventoryEntry => ({
  method, path, role: 'ADMIN', ...global(reason),
});

const superAdminRoute = (method: RouteInventoryEntry['method'], path: string, reason: string): RouteInventoryEntry => ({
  method, path, role: 'SUPER_ADMIN', ...global(reason),
});

const API = '/api/v1';

/**
 * Expected HTTP and WebSocket registration surface. Route access is recorded from the API contract;
 * resource boundaries are explicit so every scoped route requires a real cross-identity test and
 * global operations carry a reviewed reason for having no owner/Event denial case.
 */
export const ROUTE_INVENTORY: RouteInventoryEntry[] = [
  publicRoute('GET', '/health'),
  publicRoute('GET', '/ready'),
  publicRoute('GET', `${API}/ping`),
  publicRoute('POST', `${API}/auth/bootstrap-super-admin`),
  publicRoute('POST', `${API}/auth/login`),
  publicRoute('POST', `${API}/auth/logout`),
  authenticatedRoute('GET', `${API}/me`),
  {
    method: 'GET', path: `${API}/ws`, role: 'AUTHENTICATED', scope: 'IDENTITY',
    scopeReason: 'The authenticated WebSocket subscription is bound to the session identity and its Participant Event or Admin role scope.',
  },
  { method: 'GET', path: `${API}/live/ws`, role: 'PUBLIC', scope: 'PUBLIC' },

  adminRoute('GET', `${API}/admin/dashboard`, 'Admin dashboard is an operational view across the current LIVE Event.'),
  adminRoute('GET', `${API}/admin/audit`, 'Audit access is role-global for Admin staff.'),
  superAdminRoute('GET', `${API}/super-admin/system`, 'System diagnostics are role-global for Super Admin.'),
  superAdminRoute('GET', `${API}/super-admin/admins`, 'Administrator management is role-global.'),
  superAdminRoute('GET', `${API}/super-admin/admins/:id`, 'Administrator profiles are managed globally by Super Admin.'),
  superAdminRoute('POST', `${API}/super-admin/admins`, 'Administrator creation is role-global.'),
  superAdminRoute('PATCH', `${API}/super-admin/admins/:id`, 'Administrator profiles are managed globally by Super Admin.'),
  superAdminRoute('DELETE', `${API}/super-admin/admins/:id`, 'Administrator deactivation is role-global.'),

  adminRoute('GET', `${API}/admin/events`, 'Events are global Admin-managed records.'),
  adminRoute('GET', `${API}/admin/events/:id`, 'Events are global Admin-managed records.'),
  adminRoute('POST', `${API}/admin/events`, 'Event creation is role-global.'),
  adminRoute('PATCH', `${API}/admin/events/:id`, 'Events are global Admin-managed records.'),

  adminRoute('GET', `${API}/admin/participants`, 'Admin participant management is not restricted to one Event.'),
  adminRoute('GET', `${API}/admin/participants/:id`, 'Admin participant management is not restricted to one Event.'),
  adminRoute('POST', `${API}/admin/participants`, 'Admin participant management is not restricted to one Event.'),
  adminRoute('POST', `${API}/admin/participants/import`, 'Admin participant management is not restricted to one Event.'),
  adminRoute('PATCH', `${API}/admin/participants/:id`, 'Admin participant management is not restricted to one Event.'),

  adminRoute('GET', `${API}/admin/keys`, 'Keys are global Admin-managed records, with Event filters for listing.'),
  adminRoute('GET', `${API}/admin/keys/:id`, 'Keys are global Admin-managed records.'),
  adminRoute('POST', `${API}/admin/keys`, 'Key creation is role-global.'),
  adminRoute('PATCH', `${API}/admin/keys/:id`, 'Keys are global Admin-managed records.'),
  adminRoute('GET', `${API}/admin/questions`, 'Questions are global Admin-managed records, with Round filters for listing.'),
  adminRoute('GET', `${API}/admin/questions/:id`, 'Questions are global Admin-managed records.'),
  adminRoute('POST', `${API}/admin/questions`, 'Question creation is role-global.'),
  adminRoute('PATCH', `${API}/admin/questions/:id`, 'Questions are global Admin-managed records.'),
  adminRoute('DELETE', `${API}/admin/questions/:id`, 'Questions are global Admin-managed records.'),

  adminRoute('GET', `${API}/admin/rounds`, 'Admin Round operations can span Events.'),
  adminRoute('GET', `${API}/admin/rounds/:id`, 'Admin Round operations can span Events.'),
  adminRoute('POST', `${API}/admin/rounds`, 'Admin Round operations can span Events.'),
  adminRoute('PATCH', `${API}/admin/rounds/:id`, 'Admin Round operations can span Events.'),
  adminRoute('POST', `${API}/admin/rounds/:id/ready`, 'Admin Round operations can span Events.'),
  adminRoute('POST', `${API}/admin/rounds/:id/start`, 'Admin Round operations can span Events.'),
  adminRoute('POST', `${API}/admin/rounds/:id/pause`, 'Admin Round operations can span Events.'),
  adminRoute('POST', `${API}/admin/rounds/:id/resume`, 'Admin Round operations can span Events.'),
  adminRoute('POST', `${API}/admin/rounds/:id/complete`, 'Admin Round operations can span Events.'),
  adminRoute('POST', `${API}/admin/rounds/:id/cancel`, 'Admin Round operations can span Events.'),
  adminRoute('POST', `${API}/admin/rounds/:id/recover`, 'Admin Round operations can span Events.'),
  participantRoute('GET', `${API}/participant/event`),
  participantRoute('GET', `${API}/participant/round/current`),

  adminRoute('POST', `${API}/admin/rounds/:id/tickets/generate`, 'Admin Ticket operations can span Events.'),
  adminRoute('GET', `${API}/admin/rounds/:id/tickets`, 'Admin Ticket operations can span Events.'),
  participantRoute('GET', `${API}/participant/ticket`),
  adminRoute('POST', `${API}/admin/rounds/:id/draws`, 'Admin Draw operations can span Events.'),
  adminRoute('POST', `${API}/admin/rounds/:id/draws/manual`, 'Admin Draw operations can span Events.'),
  adminRoute('GET', `${API}/admin/rounds/:id/draws`, 'Admin Draw history access is role-global.'),
  participantRoute('GET', `${API}/participant/draws`),
  participantRoute('POST', `${API}/participant/tickets/:ticketId/marks`),
  participantRoute('DELETE', `${API}/participant/tickets/:ticketId/marks/:cellId`),
  participantRoute('POST', `${API}/participant/claims`),
  participantRoute('GET', `${API}/participant/claims`),
  adminRoute('GET', `${API}/admin/claims`, 'Admin Claim review is role-global.'),
  adminRoute('POST', `${API}/admin/claims/:id/verify`, 'Admin Claim review is role-global.'),
  adminRoute('POST', `${API}/admin/claims/:id/reject`, 'Admin Claim review is role-global.'),
  adminRoute('GET', `${API}/admin/winners`, 'Admin Winner history is role-global.'),
  participantRoute('GET', `${API}/participant/wins`),

  publicRoute('GET', `${API}/live/event`),
  publicRoute('GET', `${API}/live/round`),
  publicRoute('GET', `${API}/live/draws`),
  publicRoute('GET', `${API}/live/winners`),
];

export const PROTECTED_ROUTES = ROUTE_INVENTORY.filter((route) => route.role !== 'PUBLIC');
export const SCOPED_ROUTES = PROTECTED_ROUTES.filter((route) => route.scope === 'PARTICIPANT_EVENT');

export function concreteProbePath(path: string): string {
  return path.replace(/:[^/]+/g, '11111111-1111-4111-8111-111111111111');
}
