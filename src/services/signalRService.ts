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
  private maxReconnectAttempts = 3; // Reduce attempts to avoid too many requests
  private reconnectDelay = 15000; // Increase delay to 15 seconds to reduce retry frequency
  private connectionCloseCount = 0; // Track how many times connection closed
  private isConnecting = false;
  private lastConnectionError: Error | null = null;

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

    const hubUrl = this.getHubUrl();

    try {
      // Stop existing connection if any
      if (this.connection) {
        await this.stop();
      }

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => {
            // SignalR will automatically add this token as access_token query parameter
            // Backend expects it in query string for SignalR connections (see Program.cs)
            return token;
          },
          // Prefer WebSocket, fallback to Server-Sent Events (SSE) only
          // Do NOT use Long Polling to avoid continuous HTTP requests
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents,
          skipNegotiation: false, // Keep negotiation to ensure proper WebSocket upgrade
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            if (retryContext.previousRetryCount < this.maxReconnectAttempts) {
              // Exponential backoff with longer delays: 15s, 30s, 45s
              const delay = this.reconnectDelay * (retryContext.previousRetryCount + 1);
              
              // Log error if available
              if (this.lastConnectionError) {
              }
              
            
              
              return delay;
            }
            return null; // Stop reconnecting after max attempts
          },
        })
        .configureLogging(signalR.LogLevel.Information) // Log connection info for debugging
        .build();

      // Set up event handlers
      this.setupEventHandlers();

      // Start connection
      console.log('[SignalR] Starting connection to:', hubUrl);
      this.lastConnectionError = null; // Clear previous error
      await this.connection.start();
      this.reconnectAttempts = 0;
      this.lastConnectionError = null; // Clear error on successful connection

      // Log transport type for debugging
      const transport = (this.connection as any).connection?.transport;
      if (transport) {
        const transportName = transport.name || transport.constructor?.name || 'Unknown';
        const transportType = transport.constructor?.name || transportName;
        
        // Detect transport type more accurately
        const isWebSocket = transportType.includes('WebSocket') || transportType.includes('WebSockets');
        const isSSE = transportType.includes('ServerSentEvents') || transportType.includes('EventSource');
        const isLongPolling = transportType.includes('LongPolling') || transportType.includes('LongPoll');
        
        
        // Log connection details
        const connectionId = (this.connection as any).connectionId;
        
        // Expose connection info for testing with detailed transport info
        if (typeof window !== 'undefined') {
          (window as any).__signalRConnection = {
            transport: transportName,
            transportType: transportType,
            isWebSocket: isWebSocket,
            isSSE: isSSE,
            isLongPolling: isLongPolling,
            isRealTime: isWebSocket || isSSE,
            state: this.connection.state,
            isConnected: this.isConnected(),
            connectionId: connectionId,
            hubUrl: hubUrl,
          };
          
          // Also add a helper function to check transport
          (window as any).checkSignalRTransport = () => {
            const info = (window as any).__signalRConnection;
            if (!info) {
              return;
            }
            
          
          };
          
        }
      } else {
      }

      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;
      
      // Check if error is due to transport not being available
      const errorMessage = error instanceof Error ? error.message : String(error);
      
     
      
      // Expose error info for debugging
      if (typeof window !== 'undefined') {
        (window as any).__signalRConnection = {
          transport: null,
          state: 'Failed',
          isConnected: false,
          error: errorMessage,
          hubUrl: hubUrl,
        };
      }
      
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
    this.connection.onclose((error) => {
      this.reconnectAttempts = 0;
      this.connectionCloseCount++;
      
      if (error) {
        this.lastConnectionError = error;
        
        // Log current transport type when connection closes
        const transport = (this.connection as any)?.connection?.transport;
        if (transport) {
        }
        
        // Log specific error details
        const errorMsg = error?.message || String(error);
        if (errorMsg.includes('404') || errorMsg.includes('No Connection')) {
        } else if (errorMsg.includes('Handshake was canceled')) {
        } else {
        }
      } else {
        this.lastConnectionError = null;
      }
      // Trigger state change event
      this.onStateChange?.();
    });

    this.connection.onreconnecting((error) => {
      this.reconnectAttempts++;
      const errorMsg = error?.message || '';
      
      // Log specific reconnection reasons
      if (errorMsg.includes('404') || errorMsg.includes('No Connection')) {
      }
      
     
      
      // Trigger state change event
      this.onStateChange?.();
    });

    this.connection.onreconnected(() => {
      this.reconnectAttempts = 0;
      // Trigger state change event
      this.onStateChange?.();
    });
  }

  // Callback for state changes (to avoid polling)
  private onStateChange: (() => void) | null = null;

  // Register state change callback
  onStateChangeCallback(callback: () => void): void {
    this.onStateChange = callback;
  }

  // Remove state change callback
  offStateChangeCallback(): void {
    this.onStateChange = null;
  }

  // Register notification handler
  onReceiveNotification(callback: (data: NotificationData) => void): void {
    if (!this.connection) {
      console.warn('[SignalR] Connection not established, cannot register handler');
      return;
    }

    // Remove existing handler first to avoid duplicates
    this.connection.off('ReceiveNotification');

    // Register handler - Backend sends "ReceiveNotification" (camelCase)
    // SignalR method names are case-insensitive, so this will work
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

