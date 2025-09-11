import { Server, Socket } from 'socket.io';
import { joinRoomService, savePizarraService } from './socket.service';

export const handleSocketEvents = (socket: Socket, io: Server) => {
  const user = socket.data.user; // ✅ Esta es la forma correcta

  socket.on('joinRoom', async ({ salaId }) => {
    try {
      socket.join(salaId);
      socket.data.salaId = salaId;

      console.log(`Se unió ${user.correo} a la sala ${salaId}`);

      const diagrama = await joinRoomService(salaId);
      socket.emit('init', diagrama);

      socket.to(salaId).emit('usuarioConectado', {
        correo: user.correo,
        salaId,
        mensaje: `🔔 ${user.correo} se ha unido a la sala.`,
      });
    } catch (error) {
      console.error('[Socket] Error al unirse a sala:', error);
      socket.emit('error', 'Error al unirse a la sala');
    }
  });

  socket.on('guardarProyecto', async (data) => {
    const salaId = data.salaId;
    const updated = await savePizarraService(salaId, data);
    socket.to(salaId).emit('actualizarProyecto', updated);
  });

  socket.on('disconnect', () => {
    const salaId = socket.data.salaId;

    if (salaId) {
      io.to(salaId).emit('usuarioDesconectado', {
        correo: user.correo,
        mensaje: 'Se desconectó de la sala',
      });
      console.log(`Usuario ${user.correo} desconectado de sala ${salaId}`);
    } else {
      console.log(`Usuario ${user.correo} se desconectó pero no estaba en ninguna sala`);
    }
  });
};
