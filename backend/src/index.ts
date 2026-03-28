import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import messageRoutes from './routes/messages';
import friendRoutes from './routes/friends';
import userRoutes from './routes/users';
import uploadRoutes from './routes/upload';
import { setupSockets } from './sockets';

const app = express();
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

export const prisma = new PrismaClient();
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
    
    setupSockets(io);
    
    server.listen(PORT as number, '0.0.0.0', () => {
      console.log(`Backend server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
