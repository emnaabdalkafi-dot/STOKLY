import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { BACKEND_URL, WS_HOST } from './api';
// Expose Pusher globally (required by Laravel Echo)
(window as any).Pusher = Pusher;

// Enable debug logging
Pusher.logToConsole = true;

let echoInstance: any = null;

const createEcho = (): any => {
  const token = localStorage.getItem('token');
  console.log('[Echo] Creating instance, token present:', !!token);

  return new Echo({
    broadcaster: 'reverb',
    key: 'p4gucxacg2eug5fsjcpr',
    wsHost: WS_HOST,
    wsPort: 443,
    wssPort: 443,
    forceTLS: true,
    disableStats: true,
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${BACKEND_URL}/api/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  });
};

/** Get or create the Echo instance — always uses the latest token */
export const getEcho = (): any => {
  if (!echoInstance) {
    echoInstance = createEcho();
  }
  return echoInstance;
};

/** Call after login/logout to recreate Echo with updated token */
export const reconnectEcho = (): any => {
  console.log('[Echo] Reconnecting with fresh token...');
  if (echoInstance) {
    try { echoInstance.disconnect(); } catch (_) { }
  }
  echoInstance = createEcho();
  return echoInstance;
};

// Default export for backward compat — but prefer getEcho() in components
export default {
  channel: (channel: string) => getEcho().channel(channel),
  private: (channel: string) => getEcho().private(channel),
  leave: (channel: string) => getEcho().leave(channel),
  disconnect: () => getEcho().disconnect(),
};
