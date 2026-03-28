import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { redisClient, prisma } from '../index';

export const setupSockets = (io: Server) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    
    const decoded = verifyToken(token);
    if (!decoded) return next(new Error('Authentication error'));
    
    socket.data.userId = decoded.userId;
    next();
  });

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`User connected: ${userId}`);
    
    // Mark user as online in Redis
    await redisClient.hSet('user:presence', userId, 'online');
    io.emit('presence_update', { userId, status: 'online' });

    socket.on('join_room', async ({ roomId }) => {
      socket.join(roomId);
      console.log(`User ${userId} joined room ${roomId}`);
    });

    socket.on('send_message', async ({ roomId, content, parentId }) => {
      try {
        const message = await prisma.message.create({
          data: {
            roomId,
            userId,
            content,
            parentId
          },
          include: { user: { select: { id: true, username: true } } }
        });
        io.to(roomId).emit('new_message', message);
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`);
      // In a real app, check if user has other active sockets before marking offline
      await redisClient.hSet('user:presence', userId, 'offline');
      io.emit('presence_update', { userId, status: 'offline' });
    });
  });
};
