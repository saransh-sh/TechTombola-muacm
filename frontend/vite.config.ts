import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { assertSupportedSocketProtocol } from './src/lib/websocket/socketUrl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  if (env.VITE_API_BASE_URL) {
    const apiUrl = new URL(env.VITE_API_BASE_URL);
    if (!['http:', 'https:'].includes(apiUrl.protocol)) throw new TypeError('VITE_API_BASE_URL must use http or https');
  }
  if (env.VITE_WS_BASE_URL) assertSupportedSocketProtocol(new URL(env.VITE_WS_BASE_URL));
  return { plugins: [react()] };
});
