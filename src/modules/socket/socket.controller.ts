import type { Server, Socket } from 'socket.io'

type ClassNode = { id: string; x: number; y: number; name?: string; attributes?: string[]; methods?: string[]; w?: number; h?: number }
type LinkEdge = { id: string; kind: string; sourceId: string; targetId: string; labels?: Record<string, any>; assocClassId?: string | null }
type DiagramModel = { classes: Record<string, ClassNode>; links: Record<string, LinkEdge> }
type RoomState = { model: DiagramModel; locks: { classes: Record<string, string>; links: Record<string, string> }; clients: Set<string> }

const rooms = new Map<string, RoomState>()
function ensureRoom(room: string): RoomState {
  let st = rooms.get(room)
  if (!st) { st = { model: { classes: {}, links: {} }, locks: { classes: {}, links: {} }, clients: new Set() }; rooms.set(room, st) }
  return st
}

export function registerSocketHandlers(io: Server, socket: Socket) {
  let currentRoom: string | null = null
  let clientId: string | null = null

  socket.on('room:join', ({ room, clientId: cid }: { room: string; clientId: string }) => {
    if (!room || !cid) return
    currentRoom = room; clientId = cid; socket.join(room)
    const st = ensureRoom(room); st.clients.add(cid)
    io.to(room).emit('presence:clients', { clients: [...st.clients] })
  })

  socket.on('state:get', ({ room }: { room: string }) => {
    const st = ensureRoom(room)
    socket.emit('state:set', { model: st.model })
    socket.emit('locks:set', st.locks)
  })

  socket.on('lock', ({ room, clientId: owner, kind, id }: { room: string; clientId: string; kind: 'class' | 'link'; id: string }) => {
    const st = ensureRoom(room)
    const box = kind === 'class' ? st.locks.classes : st.locks.links
    if (box[id] && box[id] !== owner) return
    box[id] = owner
    socket.to(room).emit('locked', { kind, id, clientId: owner })
  })

  socket.on('unlock', ({ room, kind, id }: { room: string; kind: 'class' | 'link'; id: string }) => {
    const st = ensureRoom(room)
    const box = kind === 'class' ? st.locks.classes : st.locks.links
    delete box[id]
    socket.to(room).emit('unlocked', { kind, id })
  })

  socket.on('op', ({ room, clientId: from, type, payload }: { room: string; clientId: string; type: string; payload: any }) => {
    const st = ensureRoom(room)
    switch (type) {
      case 'class.add': {
        const { id, x, y, name, attributes, methods, w, h } = payload as ClassNode
        st.model.classes[id] = { id, x, y, name, attributes, methods, w, h }
        socket.to(room).emit('op', { clientId: from, type, payload }); return
      }
      case 'class.move': {
        const { id, x, y } = payload as { id: string; x: number; y: number }
        const c = st.model.classes[id]; if (c) { c.x = x; c.y = y } else { st.model.classes[id] = { id, x, y } }
        socket.to(room).emit('op', { clientId: from, type, payload }); return
      }
      case 'class.update': {
        const p = payload as Partial<ClassNode> & { id: string }
        const c = st.model.classes[p.id]; if (!c) return
        if (p.name !== undefined) c.name = p.name
        if (p.attributes !== undefined) c.attributes = p.attributes
        if (p.methods !== undefined) c.methods = p.methods
        if (p.w !== undefined) c.w = p.w
        if (p.h !== undefined) c.h = p.h
        socket.to(room).emit('op', { clientId: from, type, payload }); return
      }
      case 'class.delete': {
        const { id } = payload as { id: string }
        if (!st.model.classes[id]) return
        delete st.model.classes[id]
        for (const lid of Object.keys(st.model.links)) {
          const L = st.model.links[lid]
          if (L.sourceId === id || L.targetId === id || L.assocClassId === id) delete st.model.links[lid]
        }
        socket.to(room).emit('op', { clientId: from, type, payload }); return
      }

      case 'link.add': {
        const { id, kind, sourceId, targetId, labels, assocClassId } = payload as LinkEdge
        st.model.links[id] = { id, kind, sourceId, targetId, labels: labels ?? {}, assocClassId: assocClassId ?? null }
        socket.to(room).emit('op', { clientId: from, type, payload }); return
      }
      case 'link.update': {
        const p = payload as Partial<LinkEdge> & { id: string }
        const L = st.model.links[p.id]; if (!L) return
        if (p.kind !== undefined) L.kind = p.kind
        if (p.labels !== undefined) L.labels = p.labels
        if ('assocClassId' in p) L.assocClassId = p.assocClassId ?? null
        socket.to(room).emit('op', { clientId: from, type, payload }); return
      }
      case 'link.delete': {
        const { id } = payload as { id: string }
        delete st.model.links[id]
        socket.to(room).emit('op', { clientId: from, type, payload }); return
      }
      default: return
    }
  })

  socket.on('disconnect', () => {
    if (!currentRoom || !clientId) return
    const st = ensureRoom(currentRoom)
    st.clients.delete(clientId)
    for (const [id, owner] of Object.entries(st.locks.classes)) {
      if (owner === clientId) { delete st.locks.classes[id]; io.to(currentRoom).emit('unlocked', { kind: 'class', id }) }
    }
    for (const [id, owner] of Object.entries(st.locks.links)) {
      if (owner === clientId) { delete st.locks.links[id]; io.to(currentRoom).emit('unlocked', { kind: 'link', id }) }
    }
    io.to(currentRoom).emit('presence:clients', { clients: [...st.clients] })
  })
}
