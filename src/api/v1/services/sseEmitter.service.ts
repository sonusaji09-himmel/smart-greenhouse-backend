import type { Response } from 'express';

export interface DashboardStreamEvent {
  type: 'sensor-reading';
  payload: Record<string, unknown>;
}

const clients = new Set<Response>();

const writeEvent = (res: Response, event: DashboardStreamEvent): boolean => {
  try {
    if (res.writableEnded || res.destroyed) return false;
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
    return true;
  } catch {
    return false;
  }
};

export const sseEmitterService = {
  addClient(res: Response): void {
    clients.add(res);
  },

  removeClient(res: Response): void {
    clients.delete(res);
  },

  broadcast(event: DashboardStreamEvent): void {
    for (const client of clients) {
      const ok = writeEvent(client, event);
      if (!ok) {
        clients.delete(client);
      }
    }
  },

  getClientCount(): number {
    return clients.size;
  },
};

export type SseEmitterService = typeof sseEmitterService;
