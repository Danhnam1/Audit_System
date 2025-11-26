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
        setIsConnected(signalRService.isConnected());
        setConnectionState(state?.toString() || null);

        // Register notification handler immediately after connection
        const handler = (data: NotificationData) => {
          console.log('[SignalRContext] New notification received:', data);
          setLatestNotification(data);
          // Trigger callback if registered
          if (notificationCallbackRef.current) {
            console.log('[SignalRContext] Triggering callback for notification');
            notificationCallbackRef.current(data);
          } else {
            console.warn('[SignalRContext] No callback registered yet');
          }
        };

        signalRService.onReceiveNotification(handler);
        console.log('[SignalRContext] Notification handler registered');
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

  const onNotification = useCallback((callback: (data: NotificationData) => void) => {
    notificationCallbackRef.current = callback;
  }, []);

  const offNotification = useCallback(() => {
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

