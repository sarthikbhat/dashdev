import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "./types";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!_socket) {
    _socket = io({
      path: "/socket.io",
      // Use the same origin — Vite proxy forwards /socket.io → backend
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return _socket;
}

export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
