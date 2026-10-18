export function liveDisplaySocketUrl(eventId: string, roundId: string) {
  const base = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const url = new URL('/api/v1/live/ws', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('eventId', eventId);
  url.searchParams.set('roundId', roundId);
  return url.toString();
}
