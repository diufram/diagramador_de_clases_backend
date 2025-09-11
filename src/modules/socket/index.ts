import { Server } from 'socket.io';
import { socketJWTAuth } from '../../middlewares/socketJWTAuth';
import { handleSocketEvents } from './socket.controller';

export const socketController = (io: Server) => {
  io.use(socketJWTAuth);

  io.on('connection', (socket) => {
    //console.log('Usuario:', (socket as any).user.correo);
    handleSocketEvents(socket, io);
  });
};
