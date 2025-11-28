import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import signalRService, { type NotificationData } from '../services/signalRService';
import useAuthStore from '../store/useAuthStore';

interface SignalRContextType {
  isConnected: boolean;
  connectionState: string | null;
  latestNotification: NotificationData | null;
  onNotification: (callback: (data: NotificationData) => void) => void;
  offNotification: () => void;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

interface SignalRProviderProps {
  children: ReactNode;
}

export function SignalRProvider({ children }: SignalRProviderProps) {
  const { token, user } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const [latestNotification, setLatestNotification] = useState<NotificationData | null>(null);
  const notificationCallbackRef = useRef<((data: NotificationData) => void) | null>(null);

  // Helper function to register handler with current callback
  const registerHandler = useCallback(() => {
    const connected = signalRService.isConnected();
    console.log('[SignalRContext] registerHandler invoked', { connected, hasCallback: !!notificationCallbackRef.current });
    if (!connected) {
      console.log('[SignalRContext] Connection not ready, skipping handler registration');
      return;
    }

    // Create handler that always uses the latest callback ref
    const handler = (data: NotificationData) => {
      console.log('[SignalRContext] Incoming notification payload', data);
      setLatestNotification(data);
      // Always check the latest callback ref
      if (notificationCallbackRef.current) {
        console.log('[SignalRContext] Dispatching notification to registered callback');
        try {
          notificationCallbackRef.current(data);
        } catch (error) {
          console.error('[SignalRContext] Error in notification callback:', error);
        }
      } else {
        console.warn('[SignalRContext] No callback registered yet; storing notification in latestNotification');
      }
    };

    signalRService.onReceiveNotification(handler);
    console.log('[SignalRContext] SignalR handler registered');
  }, []);

  // Initialize SignalR connection when user is authenticated
  useEffect(() => {
    if (!token || !user) {
      // Disconnect if user logs out
      signalRService.stop().catch(console.error);
      setIsConnected(false);
      setConnectionState(null);
      return;
    }

    // Start connection
    const connect = async () => {
      try {
        await signalRService.start();
        const state = signalRService.getState();
        const connected = signalRService.isConnected();
        setIsConnected(connected);
        setConnectionState(state?.toString() || null);

        // Register notification handler immediately after connection
        registerHandler();
        console.log('[SignalRContext] Connection established; handler registration attempted');
      } catch (error) {
        console.error('[SignalRContext] Failed to connect:', error);
        setIsConnected(false);
        setConnectionState(null);
      }
    };

    void connect();

    // Cleanup on unmount or when token/user changes
    return () => {
      signalRService.offReceiveNotification();
      notificationCallbackRef.current = null;
    };
  }, [token, user]);

  // Monitor connection state changes
  useEffect(() => {
    if (!token || !user) return;

    const interval = setInterval(() => {
      const connected = signalRService.isConnected();
      const state = signalRService.getState();
      setIsConnected(connected);
      setConnectionState(state?.toString() || null);
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [token, user]);

  // Re-register handler when connection state changes to connected
  useEffect(() => {
    if (isConnected && signalRService.isConnected()) {
      registerHandler();
    }
  }, [isConnected, registerHandler]);

  const onNotification = useCallback((callback: (data: NotificationData) => void) => {
    console.log('[SignalRContext] Registering notification callback');
    notificationCallbackRef.current = callback;
    
    // Re-register handler immediately to use new callback
    registerHandler();
    
    // If there's a pending notification (arrived before callback was registered), trigger it now
    if (latestNotification) {
      console.log('[SignalRContext] Triggering callback for pending notification');
      try {
        callback(latestNotification);
      } catch (error) {
        console.error('[SignalRContext] Error triggering callback for pending notification:', error);
      }
    }
  }, [registerHandler, latestNotification]);

  const offNotification = useCallback(() => {
    console.log('[SignalRContext] Unregistering notification callback');
    notificationCallbackRef.current = null;
  }, []);

  const value: SignalRContextType = {
    isConnected,
    connectionState,
    latestNotification,
    onNotification,
    offNotification,
  };

  return <SignalRContext.Provider value={value}>{children}</SignalRContext.Provider>;
}

// Hook to use SignalR context
export function useSignalR() {
  const context = useContext(SignalRContext);
  if (context === undefined) {
    throw new Error('useSignalR must be used within a SignalRProvider');
  }
  return context;
}

