import { io, Socket } from 'socket.io-client';
import { usePresenceStore } from '../store/presenceStore';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    if (this.socket?.connected) return;

    const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

    this.socket = io(API_URL || '/', {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    // Update presence store when server broadcasts status changes
    this.socket.on('presence_update', ({ userId, status }: { userId: string; status: 'online' | 'afk' | 'offline' }) => {
      usePresenceStore.getState().setStatus(userId, status);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketService();
