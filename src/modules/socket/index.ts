import { Server } from 'socket.io'
import { socketJWTAuth } from '../../middlewares/socketJWTAuth'
import { registerSocketHandlers } from './socket.controller'

export const socketController = (io: Server) => {
  io.use(socketJWTAuth)
  io.on('connection', (socket) => registerSocketHandlers(io, socket))
}
