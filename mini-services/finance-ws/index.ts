import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const FINANCE_ROOM = 'finance'

// Track connected clients
const connectedClients = new Map<string, { id: string; joinedAt: Date }>()

/**
 * Broadcast a dashboard:updated event whenever any data changes.
 * This acts as a catch-all signal for clients to refresh their dashboard.
 */
function broadcastDashboardUpdate() {
  io.to(FINANCE_ROOM).emit('dashboard:updated', {
    timestamp: new Date().toISOString(),
  })
}

/**
 * Broadcast a notification to all clients in the finance room.
 */
function broadcastNotification(message: string, type: 'success' | 'warning' | 'info') {
  io.to(FINANCE_ROOM).emit('notification', {
    message,
    type,
    timestamp: new Date().toISOString(),
  })
}

io.on('connection', (socket) => {
  console.log(`[finance-ws] Client connected: ${socket.id}`)

  connectedClients.set(socket.id, { id: socket.id, joinedAt: new Date() })

  // ─── Client Events ──────────────────────────────────────────────

  /**
   * Client joins the finance room to receive real-time updates.
   */
  socket.on('join', () => {
    socket.join(FINANCE_ROOM)
    console.log(`[finance-ws] Client ${socket.id} joined room "${FINANCE_ROOM}" (total in room: ${io.sockets.adapter.rooms.get(FINANCE_ROOM)?.size ?? 0})`)

    socket.emit('joined', {
      room: FINANCE_ROOM,
      timestamp: new Date().toISOString(),
    })
  })

  /**
   * Client leaves the finance room.
   */
  socket.on('leave', () => {
    socket.leave(FINANCE_ROOM)
    console.log(`[finance-ws] Client ${socket.id} left room "${FINANCE_ROOM}" (total in room: ${io.sockets.adapter.rooms.get(FINANCE_ROOM)?.size ?? 0})`)
  })

  // ─── Notification trigger ───────────────────────────────────────

  /**
   * Allow a connected client to trigger a notification to all room members.
   * Payload: { message: string, type?: 'success' | 'warning' | 'info' }
   */
  socket.on('send:notification', (data: { message: string; type?: 'success' | 'warning' | 'info' }) => {
    const type = data.type ?? 'info'
    console.log(`[finance-ws] Notification from ${socket.id}: [${type}] ${data.message}`)
    broadcastNotification(data.message, type)
  })

  // ─── Transaction Events (broadcast helpers) ─────────────────────

  /**
   * Broadcast a new transaction was created.
   */
  socket.on('broadcast:transaction:created', (data: unknown) => {
    io.to(FINANCE_ROOM).emit('transaction:created', data)
    broadcastDashboardUpdate()
    console.log(`[finance-ws] transaction:created broadcast by ${socket.id}`)
  })

  /**
   * Broadcast a transaction was updated.
   */
  socket.on('broadcast:transaction:updated', (data: unknown) => {
    io.to(FINANCE_ROOM).emit('transaction:updated', data)
    broadcastDashboardUpdate()
    console.log(`[finance-ws] transaction:updated broadcast by ${socket.id}`)
  })

  /**
   * Broadcast a transaction was deleted.
   */
  socket.on('broadcast:transaction:deleted', (data: unknown) => {
    io.to(FINANCE_ROOM).emit('transaction:deleted', data)
    broadcastDashboardUpdate()
    console.log(`[finance-ws] transaction:deleted broadcast by ${socket.id}`)
  })

  // ─── Purchase Events (broadcast helpers) ────────────────────────

  /**
   * Broadcast a new purchase was created.
   */
  socket.on('broadcast:purchase:created', (data: unknown) => {
    io.to(FINANCE_ROOM).emit('purchase:created', data)
    broadcastDashboardUpdate()
    console.log(`[finance-ws] purchase:created broadcast by ${socket.id}`)
  })

  /**
   * Broadcast a purchase was updated.
   */
  socket.on('broadcast:purchase:updated', (data: unknown) => {
    io.to(FINANCE_ROOM).emit('purchase:updated', data)
    broadcastDashboardUpdate()
    console.log(`[finance-ws] purchase:updated broadcast by ${socket.id}`)
  })

  /**
   * Broadcast a purchase was deleted.
   */
  socket.on('broadcast:purchase:deleted', (data: unknown) => {
    io.to(FINANCE_ROOM).emit('purchase:deleted', data)
    broadcastDashboardUpdate()
    console.log(`[finance-ws] purchase:deleted broadcast by ${socket.id}`)
  })

  // ─── Account & Card Events ──────────────────────────────────────

  /**
   * Broadcast an account balance change.
   */
  socket.on('broadcast:account:updated', (data: unknown) => {
    io.to(FINANCE_ROOM).emit('account:updated', data)
    broadcastDashboardUpdate()
    console.log(`[finance-ws] account:updated broadcast by ${socket.id}`)
  })

  /**
   * Broadcast a card balance change.
   */
  socket.on('broadcast:card:updated', (data: unknown) => {
    io.to(FINANCE_ROOM).emit('card:updated', data)
    broadcastDashboardUpdate()
    console.log(`[finance-ws] card:updated broadcast by ${socket.id}`)
  })

  // ─── Disconnect ─────────────────────────────────────────────────

  socket.on('disconnect', (reason) => {
    connectedClients.delete(socket.id)
    console.log(`[finance-ws] Client disconnected: ${socket.id} (reason: ${reason}) — ${connectedClients.size} client(s) remaining`)
  })

  socket.on('error', (error) => {
    console.error(`[finance-ws] Socket error (${socket.id}):`, error)
  })
})

// ─── Start Server ──────────────────────────────────────────────────

const PORT = 3004
httpServer.listen(PORT, () => {
  console.log(`[finance-ws] Socket.io server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[finance-ws] Received SIGTERM, shutting down...')
  httpServer.close(() => {
    console.log('[finance-ws] Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[finance-ws] Received SIGINT, shutting down...')
  httpServer.close(() => {
    console.log('[finance-ws] Server closed')
    process.exit(0)
  })
})
