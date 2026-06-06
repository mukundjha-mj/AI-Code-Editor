import { WebSocketServer } from "ws";
import type { Server } from "http";

export const createSocketGateway = (server: Server) => {
  return new WebSocketServer({ server });
};
