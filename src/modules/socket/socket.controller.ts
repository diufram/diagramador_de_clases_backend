import type { Server, Socket } from 'socket.io'

type ClassNode = { id: string; x: number; y: number; name?: string }
type DiagramModel = { classes: Record<string, ClassNode> }
type RoomState = {
  model: DiagramModel
  locks: { classes: Record<string, string> } // id -> clientId
  clients: Set<string>
}

const rooms = new Map<string, RoomState>()

function ensureRoom(room: string): RoomState {
  let st = rooms.get(room)
  if (!st) {
    st = { model: { classes: {} }, locks: { classes: {} }, clients: new Set() }
    rooms.set(room, st)
  }
  return st
}

export function registerSocketHandlers(io: Server, socket: Socket) {
  let currentRoom: string | null = null
  let clientId: string | null = null

  socket.on('room:join', ({ room, clientId: cid }) => {
    currentRoom = room
    clientId = cid
    socket.join(room)
    const st = ensureRoom(room)
    st.clients.add(cid)
  })

  socket.on('state:get', ({ room }) => {
    const st = ensureRoom(room)
    socket.emit('state:set', { model: st.model })
    socket.emit('locks:set', { classes: st.locks.classes })
  })

  // ---- Locks
  socket.on('lock', ({ room, clientId: owner, id }) => {
    const st = ensureRoom(room)
    if (st.locks.classes[id] && st.locks.classes[id] !== owner) return
    st.locks.classes[id] = owner
    socket.to(room).emit('locked', { id, clientId: owner })
  })
  socket.on('unlock', ({ room, id }) => {
    const st = ensureRoom(room)
    delete st.locks.classes[id]
    socket.to(room).emit('unlocked', { id })
  })

  // ---- Ops colaborativas
  socket.on('op', ({ room, clientId: from, type, payload }) => {
    const st = ensureRoom(room)

    if (type === 'class.add') {
      const { id, x, y, name } = payload as { id: string; x: number; y: number; name?: string }
      st.model.classes[id] = { id, x, y, name }
      socket.to(room).emit('op', { clientId: from, type, payload })
      return
    }

    if (type === 'class.move') {
      const { id, x, y } = payload as { id: string; x: number; y: number }
      if (!st.model.classes[id]) st.model.classes[id] = { id, x, y }
      else { st.model.classes[id].x = x; st.model.classes[id].y = y }
      socket.to(room).emit('op', { clientId: from, type, payload })
      return
    }

    // otros tipos: ignorados en este caso mínimo
  })

  socket.on('disconnect', () => {
    if (!currentRoom || !clientId) return
    const st = ensureRoom(currentRoom)
    st.clients.delete(clientId)
    for (const [id, owner] of Object.entries(st.locks.classes)) {
      if (owner === clientId) {
        delete st.locks.classes[id]
        io.to(currentRoom).emit('unlocked', { id })
      }
    }
  })
}
