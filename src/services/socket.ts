import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '@/api/getApiUrl';

class SocketService {
  private socket: Socket | null = null;
  private _userId: string | null = null;

  connect(userId: string) {
    if (this.socket?.connected) return;

    this._userId = userId;

    this.socket = io(getApiUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('[socket] connected:', this.socket?.id);
      // Auto-join user room so gateway can route events to us
      if (this._userId) {
        this.socket?.emit('join', { userId: this._userId });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[socket] connection error:', err.message);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this._userId = null;
    }
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  emit(event: string, data: any) {
    this.socket?.emit(event, data);
  }

  // Chat room helpers
  joinRoom(roomId: string) {
    this.emit('join_room', { roomId });
  }

  leaveRoom(roomId: string) {
    this.emit('leave_room', { roomId });
  }
}

export const socketService = new SocketService();
