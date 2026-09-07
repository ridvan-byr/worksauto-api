import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { getAllowedOrigins } from '../../shared/constants/cors.constants';

@WebSocketGateway({
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  afterInit(_server: Server) {
    this.logger.log('⚡ WebSocket EventsGateway initialized on namespace /events');
  }

  async handleConnection(client: Socket) {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!rawToken) {
        this.logger.debug(`Socket connection without token (${client.id}), joining anonymous public room.`);
        client.join('public');
        return;
      }

      const jwtSecret = process.env.JWT_SECRET;
      const payload: any = this.jwtService.verify(rawToken, { secret: jwtSecret });

      const userId = payload.sub || payload.id;
      const tenantId = payload.tenantId;
      const role = payload.role;

      client.data = { userId, tenantId, role };

      if (tenantId) {
        client.join(`tenant:${tenantId}`);
        this.logger.log(`Client ${client.id} joined room tenant:${tenantId}`);
      }

      if (userId) {
        client.join(`user:${userId}`);
        this.logger.log(`Client ${client.id} joined room user:${userId}`);
      }

      if (role === 'SUPER_ADMIN') {
        client.join('admin:control-plane');
        this.logger.log(`Super Admin ${client.id} joined room admin:control-plane`);
      }

      client.emit('connection:ready', {
        status: 'CONNECTED',
        userId,
        tenantId,
        serverTime: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.warn(`WebSocket handshake token verification failed for client ${client.id}: ${err.message}`);
      client.join('public');
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Belirli bir kiracıya (Tenant / Servis Odası) anlık olay yayını yapar
   */
  emitToTenant(tenantId: string, event: string, payload: any) {
    if (!this.server) return;
    this.server.to(`tenant:${tenantId}`).emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Kiracı odasındaki kullanıcılara, işlemi yapan kişi (actor) hariç ve isteğe bağlı rol filtreli olay yayını yapar
   */
  emitToTenantExcept(
    tenantId: string,
    excludeUserId: string | undefined,
    event: string,
    payload: any,
    targetRoles?: string[],
  ) {
    if (!this.server) return;
    const adapter = (this.server as any).adapter;
    const room = adapter?.rooms?.get(`tenant:${tenantId}`);
    if (!room) return;

    const body = {
      ...payload,
      timestamp: new Date().toISOString(),
    };

    const socketsMap = (this.server as any).sockets;
    for (const socketId of room) {
      const clientSocket = socketsMap?.get
        ? socketsMap.get(socketId)
        : (this.server as any).sockets?.[socketId];
      if (!clientSocket) continue;

      // 1. Actor Exclusion: İşlemi bizzat yapan kişiye ses/bildirim gönderme
      if (excludeUserId && clientSocket.data?.userId === excludeUserId) {
        continue;
      }

      // 2. Rol Bazlı Hedefleme: Eğer roller kısıtlanmışsa kontrol et
      if (targetRoles && targetRoles.length > 0) {
        if (!targetRoles.includes(clientSocket.data?.role)) {
          continue;
        }
      }

      clientSocket.emit(event, body);
    }
  }

  /**
   * Belirli bir kullanıcıya (Kişisel Oda) anlık olay yayını yapar
   */
  emitToUser(userId: string, event: string, payload: any) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Super Admin Platform Konsoluna kritik güvenlik / sistem olayı yayını yapar
   */
  emitToAdmin(event: string, payload: any) {
    if (!this.server) return;
    this.server.to('admin:control-plane').emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Tüm bağlı istemcilere genel sistem duyurusu yayınlar
   */
  broadcast(event: string, payload: any) {
    if (!this.server) return;
    this.server.emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }
}
