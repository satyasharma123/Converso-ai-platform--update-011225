import { Response } from 'express';

type SSEClient = {
  id: string;
  res: Response;
};

const clients = new Map<string, SSEClient>();

/**
 * Register an SSE client and keep the connection open.
 */
export function addSseClient(_req: any, res: Response) {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send a ping to establish the stream
  res.write(`event: ping\ndata: "connected"\n\n`);

  const clientId = `${Date.now()}-${Math.random()}`;
  clients.set(clientId, { id: clientId, res });

  // Clean up on close
  reqOnClose(res, clientId);
}

/**
 * Broadcast an SSE event to all connected clients.
 */
export function sendSseEvent(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(({ res }) => {
    try {
      res.write(payload);
    } catch {
      // If write fails, ignore; cleanup happens on close
    }
  });
}

function reqOnClose(res: Response, clientId: string) {
  res.on('close', () => {
    clients.delete(clientId);
  });
}






