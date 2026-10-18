export function socketUrl(path: string, search: URLSearchParams) {
  const base = import.meta.env.VITE_WS_BASE_URL || import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const url = new URL(path, base);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
    throw new TypeError('WebSocket base URL must use http, https, ws, or wss');
  }
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.search = search.toString();
  return url.toString();
}
