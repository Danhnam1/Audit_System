import * as signalR from '@microsoft/signalr';
import useAuthStore from '../store/useAuthStore';

export interface NotificationData {
  notificationId?: string;
  userId?: string;
  title?: string;
  message?: string;
  entityType?: string;
  entityId?: string;
  category?: string;
  isRead?: boolean;
  status?: string;
  readAt?: string | null;
  createdAt?: string;
}

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 seconds
  private isConnecting = false;

  // Get base URL for SignalR hub
  private getHubUrl(): string {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://moca.mom/api';
    // Remove trailing /api if present, then add /hubs/notification
    const cleanUrl = baseUrl.replace(/\/api$/, '');
    return `${cleanUrl}/hubs/notification`;
  }

  // Get access token
  private getToken(): string | null {
    return useAuthStore.getState().token;
  }

  // Start connection
  async start(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    const token = this.getToken();
    if (!token) {
      console.warn('[SignalR] No token available, cannot connect');
      return;
    }

    this.isConnecting = true;

    try {
      // Stop existing connection if any
      if (this.connection) {
        await this.stop();
      }

      const hubUrl = this.getHubUrl();

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => token,
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            if (retryContext.previousRetryCount < this.maxReconnectAttempts) {
              return this.reconnectDelay;
            }
            return null; // Stop reconnecting after max attempts
          },
        })
        .build();

      // Set up event handlers
      this.setupEventHandlers();

      // Start connection
      await this.connection.start();
      this.reconnectAttempts = 0;

      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;
      console.error('[SignalR] Connection failed:', error);
      throw error;
    }
  }

  // Stop connection
  async stop(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (error) {
        console.error('[SignalR] Error stopping connection:', error);
      } finally {
        this.connection = null;
        this.reconnectAttempts = 0;
      }
    }
  }

  // Setup event handlers
  private setupEventHandlers(): void {
    if (!this.connection) return;

    // Connection state changes
    this.connection.onclose((_error) => {
      this.reconnectAttempts = 0;
    });

    this.connection.onreconnecting((_error) => {
      this.reconnectAttempts++;
    });

    this.connection.onreconnected((_connectionId) => {
      this.reconnectAttempts = 0;
    });
  }

  // Register notification handler
  onReceiveNotification(callback: (data: NotificationData) => void): void {
    if (!this.connection) {
      console.warn('[SignalR] Connection not established, cannot register handler');
      return;
    }

    // Remove existing handler first to avoid duplicates
    this.connection.off('ReceiveNotification');

    // Register new handler
    this.connection.on('ReceiveNotification', (data: NotificationData) => {
      try {
        callback(data);
      } catch (error) {
        console.error('[SignalR] Error in notification callback:', error);
      }
    });
    
  }

  // Remove notification handler
  offReceiveNotification(): void {
    if (this.connection) {
      this.connection.off('ReceiveNotification');
    }
  }

  // Get connection state
  getState(): signalR.HubConnectionState | null {
    return this.connection?.state ?? null;
  }

  // Check if connected
  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }
}

// Export singleton instance
export const signalRService = new SignalRService();
export default signalRService;

