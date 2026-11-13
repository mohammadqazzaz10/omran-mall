import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  namespace: '/breaks',
})
export class BreaksGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('BreaksGateway');

  /**
   * Fail closed until the verified JWT/session authentication middleware and
   * server-side branch-membership lookup are implemented. Never trust a
   * branchId supplied in the socket query string to authorize room access.
   */
  handleConnection(client: Socket): void {
    this.logger.warn(
      `Rejected unauthenticated breaks socket connection: ${client.id}`,
    );
    client.disconnect(true);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  broadcastBreakStarted(branchId: string, sessionData: unknown): void {
    this.server.to(`branch_${branchId}`).emit('break_started', {
      event: 'BREAK_STARTED',
      timestamp: new Date().toISOString(),
      session: sessionData,
    });
  }

  broadcastBreakAlert(branchId: string, alertData: unknown): void {
    this.server.to(`branch_${branchId}`).emit('break_alert', {
      event: 'BREAK_OVERSTAY_ALERT',
      timestamp: new Date().toISOString(),
      alert: alertData,
    });
  }

  broadcastBreakEnded(branchId: string, sessionData: unknown): void {
    this.server.to(`branch_${branchId}`).emit('break_ended', {
      event: 'BREAK_ENDED',
      timestamp: new Date().toISOString(),
      session: sessionData,
    });
  }
}
