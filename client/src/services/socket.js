import { io } from 'socket.io-client';

// Same-origin Socket.IO client. Vite proxies /socket.io in development.
export const socket = io({
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});
