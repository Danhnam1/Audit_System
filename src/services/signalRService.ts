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
              const delaySeconds = Math.round(delay / 1000);
              console.warn(`[SignalR] ⚠️ Connection lost. Will retry in ${delaySeconds}s (attempt ${retryContext.previousRetryCount + 1}/${this.maxReconnectAttempts})`);
              
              // Log error if available
              if (this.lastConnectionError) {
                console.warn(`[SignalR] Last error:`, this.lastConnectionError.message);
              }
              
              // Warn about network requests
              if (retryContext.previousRetryCount > 0) {
                console.warn(`[SignalR] 💡 Each retry creates negotiation requests (preflight + fetch)`);
                console.warn(`[SignalR] 💡 This explains multiple requests in Network tab`);
                console.warn(`[SignalR] 💡 Total connection closures so far: ${this.connectionCloseCount}`);
                console.warn(`[SignalR] 💡 If backend fixed timeout, connection should be more stable`);
              }
              
              return delay;
            }
            console.error('[SignalR] ❌ Max reconnection attempts reached. Stopping automatic reconnection.');
            console.error('[SignalR] 💡 Connection will need manual retry or page refresh');
            console.error('[SignalR] 💡 Check backend logs for connection issues');
            console.error('[SignalR] 💡 Many network requests were due to reconnection attempts');
            console.error(`[SignalR] 💡 Connection closed ${this.connectionCloseCount} time(s) total`);
            console.error('[SignalR] 💡 After backend fixes timeout, connection should be more stable');
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
        
        // Log with clear indication
        console.log('═══════════════════════════════════════════════════════');
        if (isLongPolling) {
          console.error('[SignalR] ❌❌❌ USING LONG POLLING ❌❌❌');
          console.error('[SignalR] This is NOT real-time! It uses continuous HTTP requests.');
          console.error('[SignalR] Transport:', transportName);
        } else if (isWebSocket) {
          console.log('[SignalR] ✅✅✅ USING WEBSOCKET (REAL-TIME) ✅✅✅');
          console.log('[SignalR] This is a persistent, bidirectional connection.');
          console.log('[SignalR] Transport:', transportName);
        } else if (isSSE) {
          console.log('[SignalR] ✅✅✅ USING SERVER-SENT EVENTS (REAL-TIME) ✅✅✅');
          console.log('[SignalR] This is a persistent, one-way connection from server.');
          console.log('[SignalR] Transport:', transportName);
          console.log('[SignalR] 💡 In Network tab, you should see type "eventsource" or "eventstream"');
        } else {
          console.warn('[SignalR] ⚠️ Unknown transport type:', transportName);
        }
        console.log('═══════════════════════════════════════════════════════');
        
        // Log connection details
        const connectionId = (this.connection as any).connectionId;
        console.log('[SignalR] Connection ID:', connectionId);
        console.log('[SignalR] Connection State:', this.connection.state);
        
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
              console.log('❌ SignalR connection info not available');
              return;
            }
            console.log('═══════════════════════════════════════════════════════');
            console.log('📡 SignalR Transport Information:');
            console.log('   Transport Name:', info.transport);
            console.log('   Transport Type:', info.transportType);
            console.log('   Is WebSocket:', info.isWebSocket ? '✅ YES' : '❌ NO');
            console.log('   Is SSE:', info.isSSE ? '✅ YES' : '❌ NO');
            console.log('   Is Long Polling:', info.isLongPolling ? '❌ YES (BAD!)' : '✅ NO');
            console.log('   Is Real-Time:', info.isRealTime ? '✅ YES' : '❌ NO');
            console.log('   Connection State:', info.state);
            console.log('   Connected:', info.isConnected ? '✅ YES' : '❌ NO');
            console.log('   Connection ID:', info.connectionId);
            console.log('═══════════════════════════════════════════════════════');
            
            // Check Network tab
            console.log('\n💡 To verify in Network tab:');
            if (info.isWebSocket) {
              console.log('   ✅ Look for type "websocket" or "ws"');
            } else if (info.isSSE) {
              console.log('   ✅ Look for type "eventsource" or "eventstream"');
            } else if (info.isLongPolling) {
              console.log('   ❌ You will see many "fetch" requests (this is polling!)');
            }
          };
          
          console.log('[SignalR] 💡 Run checkSignalRTransport() in console to see transport details');
        }
      } else {
        console.warn('[SignalR] ⚠️ Connected but transport info not available');
      }

      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;
      console.error('[SignalR] ❌ Connection failed:', error);
      
      // Check if error is due to transport not being available
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SignalR] Error details:', {
        message: errorMessage,
        hubUrl: hubUrl,
        hasToken: !!token,
      });
      
      if (errorMessage.includes('WebSocket') || errorMessage.includes('transport') || errorMessage.includes('ServerSentEvents')) {
        console.error('[SignalR] Connection failed. Please ensure:');
        console.error('  1. Backend supports WebSocket or Server-Sent Events connections');
        console.error('  2. Network/proxy allows WebSocket/SSE connections');
        console.error('  3. Using HTTPS (WebSocket requires secure connection in production)');
        console.error('  4. Backend has WebSocket middleware enabled');
        console.error('  5. Check Network tab for failed requests to:', hubUrl);
      }
      
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
        console.warn('[SignalR] ⚠️ Connection closed with error:', error);
        console.warn(`[SignalR] ⚠️ This is closure #${this.connectionCloseCount}`);
        
        // Log current transport type when connection closes
        const transport = (this.connection as any)?.connection?.transport;
        if (transport) {
          const transportName = transport.name || transport.constructor?.name || 'Unknown';
          console.warn('[SignalR] ⚠️ Connection was using transport:', transportName);
        }
        
        // Log specific error details
        const errorMsg = error?.message || String(error);
        if (errorMsg.includes('404') || errorMsg.includes('No Connection')) {
          console.error('[SignalR] ❌ Backend returned 404 - Connection ID not found');
          console.error('[SignalR] 💡 Possible causes:');
          console.error('   1. Backend connection was closed/expired');
          console.error('   2. Connection ID mismatch');
          console.error('   3. Backend SignalR hub configuration issue');
          console.error('   4. SSE connection timeout (backend closed connection)');
          console.error('[SignalR] 💡 This will trigger reconnection attempts');
          console.error(`[SignalR] 💡 Each retry creates new network requests (explains many requests in Network tab)`);
        } else if (errorMsg.includes('Handshake was canceled')) {
          console.error('[SignalR] ❌ Handshake was canceled');
          console.error('[SignalR] 💡 Backend might have closed connection during handshake');
          console.error('[SignalR] 💡 This will trigger reconnection attempts');
        } else {
          console.error('[SignalR] 💡 Connection error will trigger automatic reconnection');
        }
      } else {
        this.lastConnectionError = null;
        console.log('[SignalR] Connection closed normally');
        console.log(`[SignalR] 💡 This is normal closure #${this.connectionCloseCount}`);
        console.log('[SignalR] 💡 Normal closure might be due to:');
        console.log('   - Backend timeout (check backend ClientTimeoutInterval = 60s)');
        console.log('   - Network interruption');
        console.log('   - Server restart or maintenance');
        console.log('[SignalR] 💡 SignalR will automatically attempt to reconnect');
        console.log('[SignalR] 💡 Reconnection will create new network requests');
      }
      // Trigger state change event
      this.onStateChange?.();
    });

    this.connection.onreconnecting((error) => {
      this.reconnectAttempts++;
      const errorMsg = error?.message || '';
      console.warn(`[SignalR] ⚠️ Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`, errorMsg);
      
      // Log specific reconnection reasons
      if (errorMsg.includes('404') || errorMsg.includes('No Connection')) {
        console.error('[SignalR] 💡 Reconnection due to connection ID not found on server');
        console.error('[SignalR] 💡 This might indicate server-side connection was closed');
      }
      
      // Warn if too many reconnection attempts
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[SignalR] ⚠️⚠️⚠️ Too many reconnection attempts!');
        console.error('[SignalR] 💡 This might cause many network requests');
        console.error('[SignalR] 💡 Check Network tab - you might see many fetch requests');
        console.error('[SignalR] 💡 Consider checking backend connection stability');
      }
      
      // Trigger state change event
      this.onStateChange?.();
    });

    this.connection.onreconnected((connectionId) => {
      this.reconnectAttempts = 0;
      console.log('[SignalR] ✅ Reconnected successfully. Connection ID:', connectionId);
      console.log('[SignalR] 💡 Connection is now stable. If backend fixed timeout, it should stay connected longer.');
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

