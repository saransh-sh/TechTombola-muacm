export function assertSupportedSocketProtocol(url: URL) {
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
    throw new TypeError('WebSocket base URL must use http, https, ws, or wss');
  }
}

export function validateDeploymentOrigins(env: Record<string, string>) {
  if (env.VITE_API_BASE_URL) {
    const apiUrl = new URL(env.VITE_API_BASE_URL);
    if (!['http:', 'https:'].includes(apiUrl.protocol)) throw new TypeError('VITE_API_BASE_URL must use http or https');
  }
  if (env.VITE_WS_BASE_URL) assertSupportedSocketProtocol(new URL(env.VITE_WS_BASE_URL));
}
