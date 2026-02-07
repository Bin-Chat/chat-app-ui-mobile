import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:8080';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
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

  // Chat events
  joinRoom(roomId: string) {
    this.emit('join_room', { roomId });
  }

  leaveRoom(roomId: string) {
    this.emit('leave_room', { roomId });
  }

  sendMessage(roomId: string, message: string) {
    this.emit('send_message', { roomId, message });
  }

  onNewMessage(callback: (message: any) => void) {
    this.on('new_message', callback);
  }

  onTyping(callback: (data: any) => void) {
    this.on('typing', callback);
  }
}

export const socketService = new SocketService();
