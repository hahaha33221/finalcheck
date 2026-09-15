const clients = new Set();

export function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write('retry: 3000\n\n');
  clients.add(res);

  // A named event (not just a `:` comment) so the client can tell "connection
  // alive, nothing changed" apart from "connection silently stalled" -- some
  // proxies/tunnels stop forwarding frames without ever firing onerror.
  const heartbeat = setInterval(() => {
    res.write('event: ping\ndata: {}\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

export function broadcastState(state) {
  const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}
