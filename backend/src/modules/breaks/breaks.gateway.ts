import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/breaks',
})
export class BreaksGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('BreaksGateway');

  handleConnection(client: Socket) {
    const branchId = client.handshake.query.branchId as string;
    if (branchId) {
      client.join(`branch_${branchId}`);
      this.logger.log(`Client ${client.id} joined live break room: branch_${branchId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Broadcast break started event to branch supervisor room
   */
  broadcastBreakStarted(branchId: string, sessionData: any) {
    this.server.to(`branch_${branchId}`).emit('break_started', {
      event: 'BREAK_STARTED',
      timestamp: new Date().toISOString(),
      session: sessionData,
    });
  }

  /**
   * Broadcast real-time timer countdown tick or overstay alert
   */
  broadcastBreakAlert(branchId: string, alertData: any) {
    this.server.to(`branch_${branchId}`).emit('break_alert', {
      event: 'BREAK_OVERSTAY_ALERT',
      timestamp: new Date().toISOString(),
      alert: alertData,
    });
  }

  /**
   * Broadcast break ended
   */
  broadcastBreakEnded(branchId: string, sessionData: any) {
    this.server.to(`branch_${branchId}`).emit('break_ended', {
      event: 'BREAK_ENDED',
      timestamp: new Date().toISOString(),
      session: sessionData,
    });
  }
}
